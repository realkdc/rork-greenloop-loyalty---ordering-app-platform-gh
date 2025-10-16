import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { MapPin, Loader } from 'lucide-react-native';
import * as Location from 'expo-location';
import colors from '@/constants/colors';
import { StorageService } from '@/services/storage';
import { SUPPORTED_STATES, STATE_NAMES, getStoresByState } from '@/constants/stores';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GeoGateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showManualSelector, setShowManualSelector] = useState(false);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
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
      const detectedState = geocode.region || geocode.isoCountryCode || '';
      console.log('Detected state:', detectedState, 'Full geocode:', geocode);
      
      handleStateDetected(detectedState);
    } catch (error) {
      console.error('Location error:', error);
      setShowManualSelector(true);
      setLoading(false);
    }
  };

  const handleStateDetected = async (state: string) => {
    const supported = SUPPORTED_STATES.includes(state as any);
    
    if (!supported) {
      setShowManualSelector(true);
      setLoading(false);
      Alert.alert(
        'Location Not Supported',
        `We currently serve IL & NJ. Please select your state manually if you're in a supported area.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const stores = getStoresByState(state);
    if (stores.length === 0) {
      setShowManualSelector(true);
      setLoading(false);
      return;
    }

    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ageVerified: existing?.ageVerified || false,
      state,
      stateSupported: true,
      activeStoreId: existing?.activeStoreId || null,
      completedOnboarding: false,
    });

    console.log('State saved, navigating to store-picker');
    router.replace('/store-picker');
  };

  const handleManualStateSelect = async (state: string) => {
    const stores = getStoresByState(state);
    if (stores.length === 0) {
      Alert.alert('No Stores', 'No stores available in this state yet.');
      return;
    }

    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ageVerified: existing?.ageVerified || false,
      state,
      stateSupported: true,
      activeStoreId: existing?.activeStoreId || null,
      completedOnboarding: false,
    });

    console.log('Manual state selected, navigating to store-picker');
    router.replace('/store-picker');
  };

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconContainer}>
            <MapPin size={56} color={colors.primary} strokeWidth={2.5} />
          </View>

          <Text style={styles.title}>Location</Text>
          <Text style={styles.subtitle}>
            {showManualSelector
              ? 'Select your state to find nearby stores'
              : 'We need your location to find stores near you'}
          </Text>

          {loading && (
            <View style={styles.loadingContainer}>
              <Loader size={32} color={colors.primary} />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          )}

          {showManualSelector && !loading && (
            <View style={styles.stateContainer}>
              <Text style={styles.stateTitle}>Select Your State</Text>
              {SUPPORTED_STATES.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={styles.stateButton}
                  onPress={() => handleManualStateSelect(state)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.stateButtonText}>{STATE_NAMES[state]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!showManualSelector && !loading && (
            <TouchableOpacity
              style={styles.button}
              onPress={requestLocation}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Request Location</Text>
            </TouchableOpacity>
          )}

          {!loading && (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setShowManualSelector(!showManualSelector)}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>
                {showManualSelector ? 'Use My Location' : 'Select State Manually'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  stateContainer: {
    width: '100%',
    gap: 12,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  stateButton: {
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  stateButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.surface,
  },
  linkButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.primary,
  },
});
