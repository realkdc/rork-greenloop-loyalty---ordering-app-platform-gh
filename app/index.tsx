import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { StorageService } from '@/services/storage';
import { useAuth } from '@/contexts/AuthContext';
import { APP_CONFIG } from '@/constants/config';
import { STORES } from '@/constants/stores';
import { useGeoGate } from '@/hooks/useGeoGate';
import { ReviewGeoGate } from '@/screens/ReviewGeoGate';
import { FakeAuthService } from '@/services/fakeAuth';
import { FakeDemoOrdersService } from '@/services/fakeDemoOrders';
import { debugLog } from '@/lib/logger';

export default function Index() {
  const router = useRouter();
  const auth = useAuth();
  const { isLoading } = auth || { isLoading: true };
  const geoGate = useGeoGate();
  const [showTimeout, setShowTimeout] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const routerRef = useRef(router);
  const demoSetupRef = useRef(false);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  debugLog(
    '[Index] 🎬 RENDERING - isLoading:',
    isLoading,
    'geoGate.checking:',
    geoGate.checking,
    'geoGate.allowed:',
    geoGate.allowed,
    'DEMO_MODE:',
    APP_CONFIG.DEMO_MODE,
    'navigating:',
    navigating
  );

  useEffect(() => {
    if (navigating) {
      return;
    }

    // Set a timeout to show retry button if loading takes too long
    const timeoutTimer = setTimeout(() => {
      debugLog('[Index] ⏰ Timeout reached - showing retry button');
      setShowTimeout(true);
    }, 8000); // Show after 8 seconds

    // DEMO MODE: Skip all geo-gate checks and go straight to onboarding bypass
    if (APP_CONFIG.DEMO_MODE) {
      debugLog('[Index] 🎭 DEMO MODE active - isLoading:', isLoading);
      if (isLoading) {
        debugLog('[Index] ⏳ Still loading auth, waiting...');
        return;
      }

      if (demoSetupRef.current) {
        return;
      }

      demoSetupRef.current = true;
      debugLog('[Index] ✅ Auth loaded, setting up demo mode...');

      const checkOnboarding = async () => {
        try {
          debugLog('[Index] 🎭 DEMO MODE: Bypassing all gates, going directly to home');

          // Initialize fake auth session for review
          debugLog('[Index] 🔐 Initializing fake auth session...');
          await FakeAuthService.initSession();
          debugLog('[Index] ✅ Fake auth session initialized');

          // Initialize sample demo order
          debugLog('[Index] 📦 Initializing sample demo order...');
          await FakeDemoOrdersService.initSampleOrder();
          debugLog('[Index] ✅ Sample demo order initialized');

          // Set up demo onboarding state
          debugLog('[Index] 📝 Setting up onboarding state...');
          await StorageService.saveOnboardingState({
            ageVerified: true,
            state: 'CA',
            stateSupported: true,
            activeStoreId: STORES[0]?.id || 'demo-store',
            completedOnboarding: true,
          });
          await StorageService.setIntroSeen(true);
          debugLog('[Index] ✅ Onboarding state saved');

          clearTimeout(timeoutTimer);
          debugLog('[Index] 🚀 Navigating to home tab...');
          setNavigating(true);
          routerRef.current.replace('/(tabs)/home');
          debugLog('[Index] ✅ Navigation to home tab initiated');
        } catch (error) {
          console.error('[Index] ❌ Failed to setup demo mode:', error);
          clearTimeout(timeoutTimer);
          debugLog('[Index] 🚀 Fallback: Navigating to home tab anyway...');
          setNavigating(true);
          routerRef.current.replace('/(tabs)/home');
        }
      };

      debugLog('[Index] ⏰ Scheduling demo mode setup in 100ms...');
      const timer = setTimeout(checkOnboarding, 100);
      return () => {
        debugLog('[Index] 🧹 Cleanup: clearing timers');
        clearTimeout(timer);
        clearTimeout(timeoutTimer);
      };
    }

    // Non-demo mode: Check geo-gate first
    if (geoGate.checking) return;
    if (!geoGate.allowed) return;
    if (isLoading) return;

    const checkOnboarding = async () => {
      try {

        const introSeen = await StorageService.getIntroSeen();
        if (!introSeen) {
          setNavigating(true);
          router.replace('/intro');
          return;
        }

        const onboarding = await StorageService.getOnboardingState();
        debugLog('Onboarding state:', onboarding);

        if (!onboarding?.ageVerified) {
          setNavigating(true);
          router.replace('/age-gate');
        } else if (!onboarding?.completedOnboarding) {
          if (!onboarding?.state) {
            setNavigating(true);
            router.replace('/geo-gate');
          } else if (!onboarding?.activeStoreId) {
            setNavigating(true);
            router.replace('/store-picker');
          } else {
            setNavigating(true);
            router.replace('/(tabs)/home');
          }
        } else {
          setNavigating(true);
          routerRef.current.replace('/(tabs)/home');
        }
      } catch (error) {
        console.error('Failed to check onboarding:', error);
        setNavigating(true);
        routerRef.current.replace('/age-gate');
      }
    };

    const timer = setTimeout(checkOnboarding, 100);
    return () => clearTimeout(timer);
  }, [navigating, isLoading, geoGate.checking, geoGate.allowed]);

  // Show geo-gate screen if location check failed (only in non-demo mode)
  if (!APP_CONFIG.DEMO_MODE && !geoGate.allowed && !geoGate.checking) {
    return <ReviewGeoGate />;
  }

  // Show loading while checking geo-gate or auth
  const handleRetry = () => {
    setShowTimeout(false);
    setNavigating(true);
    routerRef.current.replace('/(tabs)/home');
  };

  // Don't render anything if we've started navigating - this prevents the spinner from showing
  // while the navigation transition is happening
  if (navigating) {
    debugLog('[Index] Navigating - returning null to hide spinner');
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10B981" />
      {showTimeout && (
        <View style={styles.timeoutContainer}>
          <Text style={styles.timeoutText}>Taking longer than expected...</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Continue to App</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
  },
  timeoutContainer: {
    marginTop: 30,
    alignItems: 'center' as const,
    paddingHorizontal: 40,
  },
  timeoutText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center' as const,
  },
  retryButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
