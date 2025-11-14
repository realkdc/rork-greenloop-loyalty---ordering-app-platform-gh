import { useEffect, useState } from 'react';
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

export default function Index() {
  const router = useRouter();
  const auth = useAuth();
  const { isLoading } = auth || { isLoading: true };
  const geoGate = useGeoGate();
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    // Set a timeout to show retry button if loading takes too long
    const timeoutTimer = setTimeout(() => {
      setShowTimeout(true);
    }, 8000); // Show after 8 seconds

    // DEMO MODE: Skip all geo-gate checks and go straight to onboarding bypass
    if (APP_CONFIG.DEMO_MODE) {
      if (isLoading) return;

      const checkOnboarding = async () => {
        try {
          console.log('🎭 DEMO MODE: Bypassing all gates, going directly to home');
          
          // Initialize fake auth session for review
          await FakeAuthService.initSession();
          console.log('✅ Fake auth session initialized');
          
          // Initialize sample demo order
          await FakeDemoOrdersService.initSampleOrder();
          console.log('✅ Sample demo order initialized');
          
          // Set up demo onboarding state
          await StorageService.saveOnboardingState({
            ageVerified: true,
            state: 'CA',
            stateSupported: true,
            activeStoreId: STORES[0]?.id || 'demo-store',
            completedOnboarding: true,
          });
          await StorageService.setIntroSeen(true);
          clearTimeout(timeoutTimer);
          router.replace('/(tabs)/home');
        } catch (error) {
          console.error('Failed to setup demo mode:', error);
          clearTimeout(timeoutTimer);
          router.replace('/(tabs)/home');
        }
      };

      const timer = setTimeout(checkOnboarding, 100);
      return () => {
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
          router.replace('/intro');
          return;
        }

        const onboarding = await StorageService.getOnboardingState();
        console.log('Onboarding state:', onboarding);
        
        if (!onboarding?.ageVerified) {
          router.replace('/age-gate');
        } else if (!onboarding?.completedOnboarding) {
          if (!onboarding?.state) {
            router.replace('/geo-gate');
          } else if (!onboarding?.activeStoreId) {
            router.replace('/store-picker');
          } else {
            router.replace('/(tabs)/home');
          }
        } else {
          router.replace('/(tabs)/home');
        }
      } catch (error) {
        console.error('Failed to check onboarding:', error);
        router.replace('/age-gate');
      }
    };

    const timer = setTimeout(checkOnboarding, 100);
    return () => clearTimeout(timer);
  }, [router, isLoading, geoGate.checking, geoGate.allowed, APP_CONFIG.DEMO_MODE]);

  // Show geo-gate screen if location check failed (only in non-demo mode)
  if (!APP_CONFIG.DEMO_MODE && !geoGate.allowed && !geoGate.checking) {
    return <ReviewGeoGate />;
  }

  // Show loading while checking geo-gate or auth
  const handleRetry = () => {
    setShowTimeout(false);
    router.replace('/(tabs)/home');
  };

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
