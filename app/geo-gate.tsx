import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { MapPin, Loader } from 'lucide-react-native';
import * as Location from 'expo-location';
import { StorageService } from '@/services/storage';
import { STORES } from '@/constants/stores';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GeoGateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showManualSelector, setShowManualSelector] = useState(false);

  const handleUseMyLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission denied');
        setShowManualSelector(true);
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const geocodes = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (!geocodes || geocodes.length === 0) {
        console.log('No geocode results');
        setShowManualSelector(true);
        setLoading(false);
        return;
      }

      const geocode = geocodes[0];
      if (!geocode) {
        console.log('No geocode data');
        setShowManualSelector(true);
        setLoading(false);
        return;
      }
      
      const detectedState = geocode.region || '';
      console.log('Detected state:', detectedState);
      
      if (detectedState === 'TN' || detectedState === 'Tennessee') {
        await handleTennesseeSelected();
      } else {
        setLoading(false);
        setShowManualSelector(true);
        Alert.alert(
          'Location Not Supported',
          'Sorry, we only serve Tennessee. Please choose your state manually if you think this is a mistake.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Location error:', error);
      setShowManualSelector(true);
      setLoading(false);
    }
  };

  const handleTennesseeSelected = async () => {
    const onlineStore = STORES[0];
    
    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ageVerified: existing?.ageVerified || false,
      state: 'TN',
      stateSupported: true,
      activeStoreId: onlineStore.id,
      completedOnboarding: true,
    });

    console.log('TN selected, store set:', onlineStore.id);
    router.replace('/(tabs)/home');
  };

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
                    onPress={handleTennesseeSelected}
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
});
