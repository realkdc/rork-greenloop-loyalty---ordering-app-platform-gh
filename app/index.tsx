import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { StorageService } from '@/services/storage';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { isLoading } = useAuth();

  useEffect(() => {
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
  }, [router, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10B981" />
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
});
