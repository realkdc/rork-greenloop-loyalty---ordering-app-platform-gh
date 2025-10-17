import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, FlatList, Platform } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { MapPin, Loader, AlertTriangle } from 'lucide-react-native';
import * as Location from 'expo-location';
import { StorageService } from '@/services/storage';
import { STORES, type StoreInfo } from '@/config/greenhaus';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/contexts/AppContext';

type ScreenState = 'location' | 'restricted' | 'stores';

type DetectedLocation = {
  state: string;
  city?: string;
};

export default function GeoGateScreen() {
  const router = useRouter();
  const { setSelectedStoreId, setLastKnownState, setOnboardingCompleted } = useApp();
  const [loading, setLoading] = useState(false);
  const [showManualSelector, setShowManualSelector] = useState(false);
  const [screenState, setScreenState] = useState<ScreenState>('location');
  const [eligibleStores, setEligibleStores] = useState<StoreInfo[]>([]);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);

  const handleStoreSelected = useCallback(async (store: StoreInfo) => {
    setLoading(true);
    
    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ageVerified: existing?.ageVerified || false,
      state: store.state,
      stateSupported: true,
      activeStoreId: store.id,
      completedOnboarding: true,
    });
    
    await setSelectedStoreId(store.id);
    await setOnboardingCompleted(true);

    console.log('[GEO] Store selected:', store.id);
    setLoading(false);
    router.replace('/(tabs)/home');
  }, [setSelectedStoreId, setOnboardingCompleted, router]);

  const handleStateVerified = useCallback(async (state: string) => {
    await setLastKnownState(state);
    
    const stores = STORES.filter(s => s.state === state);
    setEligibleStores(stores);
    
    // Always show store picker screen, even if there's only one store
    setLoading(false);
    setScreenState('stores');
  }, [setLastKnownState]);

  const detectAndProcessLocation = useCallback(async (requestPermission: boolean) => {
    if ((Platform.OS as string) === 'web') {
      Alert.alert(
        'Location Not Available',
        'Location services are not supported in web preview. Please select your state manually or test on a real device.',
        [{ text: 'OK', onPress: () => setShowManualSelector(true) }]
      );
      return;
    }
    
    setLoading(true);
    
    const timeoutId = setTimeout(() => {
      console.warn('[GEO] Location request timed out');
      setLoading(false);
      setShowManualSelector(true);
      Alert.alert('Location Timeout', 'Location request took too long. Please select your state manually.');
    }, 10000);
    
    try {
      let status = 'granted';
      
      if (requestPermission) {
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;
      }
      
      if (status !== 'granted') {
        console.log('[GEO] Location permission denied');
        clearTimeout(timeoutId);
        setShowManualSelector(true);
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      clearTimeout(timeoutId);
      
      setUserCoords({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      
      const geocodes = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (!geocodes || geocodes.length === 0) {
        console.log('[GEO] No geocode results');
        setShowManualSelector(true);
        setLoading(false);
        return;
      }

      const geocode = geocodes[0];
      if (!geocode) {
        console.log('[GEO] No geocode data');
        setShowManualSelector(true);
        setLoading(false);
        return;
      }
      
      const detectedState = geocode.region || '';
      const detectedCity = geocode.city || '';
      console.log('[GEO] Detected location:', detectedCity, detectedState);
      
      // Store the detected location for display
      setDetectedLocation({
        state: detectedState,
        city: detectedCity,
      });
      
      const normalized = /tennessee/i.test(detectedState) ? 'TN' : detectedState;
      
      if (normalized === 'TN') {
        await handleStateVerified('TN');
      } else {
        setLoading(false);
        setScreenState('restricted');
      }
    } catch (error) {
      console.error('[GEO] Location error:', error);
      clearTimeout(timeoutId);
      setShowManualSelector(true);
      setLoading(false);
      
      if ((Platform.OS as string) !== 'web') {
        Alert.alert(
          'Location Error',
          'Could not get your location. Please select your state manually.',
          [{ text: 'OK' }]
        );
      }
    }
  }, [handleStateVerified]);

  useEffect(() => {
    const checkExistingPermission = async () => {
      if ((Platform.OS as string) === 'web') {
        console.log('[GEO] Web platform detected; skipping auto-location');
        setShowManualSelector(true);
        return;
      }
      
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          console.log('[GEO] Permission already granted, auto-detecting location');
          await detectAndProcessLocation(false);
        }
      } catch (error) {
        console.error('[GEO] Error checking permission:', error);
        setShowManualSelector(true);
      }
    };
    
    checkExistingPermission();
  }, [detectAndProcessLocation]);

  const handleUseMyLocation = async () => {
    await detectAndProcessLocation(true);
  };

  const handleManualTennesseeSelect = async () => {
    await handleStateVerified('TN');
  };

  const calculateDistance = (storeLat: number, storeLng: number): string => {
    if (!userCoords) return '';
    
    const R = 3959;
    const dLat = ((storeLat - userCoords.lat) * Math.PI) / 180;
    const dLon = ((storeLng - userCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userCoords.lat * Math.PI) / 180) *
        Math.cos((storeLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return `${distance.toFixed(1)} mi`;
  };

  if (screenState === 'restricted') {
    const locationText = detectedLocation
      ? `${detectedLocation.city ? detectedLocation.city + ', ' : ''}${detectedLocation.state}`
      : 'your current location';

    return (
      <View style={styles.wrapper}>
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <AlertTriangle size={56} color="#DC2626" strokeWidth={2.5} />
            </View>

            <Text style={styles.title}>Sorry, {locationText}</Text>
            <Text style={styles.subtitle}>
              Due to app store policy, this app can only be used in states where our stores are located.
            </Text>
            <Text style={[styles.subtitle, { marginTop: 16 }]}>
              We currently operate in <Text style={styles.highlightText}>Tennessee</Text>.
            </Text>
            <Text style={[styles.subtitle, { marginTop: 16, fontSize: 15 }]}>
              If you think this is a mistake, you can manually select your state.
            </Text>

            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setScreenState('location');
                setShowManualSelector(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Select State Manually</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (screenState === 'stores') {
    return (
      <View style={styles.wrapper}>
        <SafeAreaView style={styles.container}>
          <View style={styles.storePickerContainer}>
            <Text style={styles.title}>Select Your Store</Text>
            <Text style={styles.subtitle}>Choose the GreenHaus location closest to you</Text>

            <FlatList
              data={eligibleStores}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.storeList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.storeCard}
                  onPress={() => handleStoreSelected(item)}
                  activeOpacity={0.85}
                >
                  <View style={styles.storeCardContent}>
                    <Text style={styles.storeName}>{item.name}</Text>
                    <Text style={styles.storeCity}>{item.city}, {item.state}</Text>
                    {item.lat && item.lng && userCoords && (
                      <Text style={styles.storeDistance}>
                        {calculateDistance(item.lat, item.lng)} away
                      </Text>
                    )}
                  </View>
                  <View style={styles.storeArrow}>
                    <Text style={styles.storeArrowText}>→</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconContainer}>
            <MapPin size={56} color="#1E4D3A" strokeWidth={2.5} />
          </View>

          <Text style={styles.title}>Where are you located?</Text>
          <Text style={styles.subtitle}>
            {showManualSelector
              ? 'Select your state to continue'
              : 'We need your location to verify you are in Tennessee'}
          </Text>

          {loading && (
            <View style={styles.loadingContainer}>
              <Loader size={32} color="#1E4D3A" />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          )}

          {!loading && (
            <>
              {!showManualSelector ? (
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleUseMyLocation}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buttonText}>Use My Location</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.stateContainer}>
                  <TouchableOpacity
                    style={styles.stateButton}
                    onPress={handleManualTennesseeSelect}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.stateButtonText}>Tennessee</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowManualSelector(!showManualSelector)}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>
                  {showManualSelector ? 'Use My Location' : 'Select State Manually'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 26,
    paddingHorizontal: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  stateContainer: {
    width: '100%',
    marginBottom: 16,
  },
  stateButton: {
    height: 54,
    backgroundColor: '#1E4D3A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E4D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  stateButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  button: {
    width: '100%',
    height: 54,
    backgroundColor: '#1E4D3A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1E4D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  linkButton: {
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#1E4D3A',
  },
  storePickerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  storeList: {
    paddingTop: 24,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  storeCardContent: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  storeCity: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#6B7280',
    marginBottom: 4,
  },
  storeDistance: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#1E4D3A',
  },
  storeArrow: {
    marginLeft: 12,
  },
  storeArrowText: {
    fontSize: 24,
    color: '#1E4D3A',
    fontWeight: '600' as const,
  },
  highlightText: {
    fontWeight: '700' as const,
    color: '#1E4D3A',
  },
});
