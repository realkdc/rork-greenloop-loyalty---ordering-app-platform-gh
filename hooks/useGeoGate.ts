import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG, REVIEW_BUILD, GEO_RESTRICT_FOR_REVIEW, REVIEW_ALLOWED_STATES } from '@/constants/config';

const REVIEWER_UNLOCK_KEY = '@greenloop_reviewer_unlock';

interface GeoGateResult {
  allowed: boolean;
  checking: boolean;
  error?: string;
}

export function useGeoGate(): GeoGateResult {
  const [result, setResult] = useState<GeoGateResult>({
    allowed: false,
    checking: true,
    error: undefined,
  });

  useEffect(() => {
    async function checkUnlockStatus() {
      // DEMO MODE: Always allow immediately, no location check needed
      if (APP_CONFIG.DEMO_MODE) {
        console.log('[GeoGate] DEMO MODE active - bypassing all geo restrictions');
        setResult({ allowed: true, checking: false });
        return;
      }

      // Check for reviewer unlock (extra safety valve)
      try {
        const reviewerUnlocked = await AsyncStorage.getItem(REVIEWER_UNLOCK_KEY);
        if (reviewerUnlocked === 'true') {
          console.log('[GeoGate] Reviewer unlock active - bypassing all restrictions');
          setResult({ allowed: true, checking: false });
          return;
        }
      } catch (error) {
        console.error('[GeoGate] Error checking reviewer unlock:', error);
      }

      // If not a review build or geo-restriction is disabled, always allow
      if (!REVIEW_BUILD || !GEO_RESTRICT_FOR_REVIEW) {
        console.log('[GeoGate] Not a review build or geo-restriction disabled, allowing access');
        setResult({ allowed: true, checking: false });
        return;
      }

      // Continue with location check...
      checkLocation();
    }

    let isMounted = true;

    async function checkLocation() {
      try {
        console.log('[GeoGate] Starting location check for review build');
        
        // Request "when in use" location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          console.log('[GeoGate] Location permission denied');
          if (isMounted) {
            setResult({
              allowed: false,
              checking: false,
              error: 'Location permission is required for this review build',
            });
          }
          return;
        }

        console.log('[GeoGate] Location permission granted, getting current position');
        
        // Get current location with timeout
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        console.log('[GeoGate] Got location:', location.coords);

        // Reverse geocode to get address components
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        console.log('[GeoGate] Reverse geocode result:', address);

        if (!address || !address.region) {
          console.log('[GeoGate] Could not determine state from location');
          if (isMounted) {
            setResult({
              allowed: false,
              checking: false,
              error: 'Could not determine your location. Please try again.',
            });
          }
          return;
        }

        // Check if the state code matches allowed states
        const stateCode = address.region; // This should be the state abbreviation like "TN"
        const isAllowed = REVIEW_ALLOWED_STATES.includes(stateCode);

        console.log('[GeoGate] State code:', stateCode, 'Allowed:', isAllowed);

        if (isMounted) {
          setResult({
            allowed: isAllowed,
            checking: false,
            error: isAllowed ? undefined : `This app is only available in licensed regions (${REVIEW_ALLOWED_STATES.join(', ')}) for this review build.`,
          });
        }
      } catch (error) {
        console.error('[GeoGate] Location check error:', error);
        if (isMounted) {
          setResult({
            allowed: false,
            checking: false,
            error: 'Failed to verify location. Please check your settings and try again.',
          });
        }
      }
    }

    checkUnlockStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return result;
}

