import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Leaf } from 'lucide-react-native';
import colors from '@/constants/colors';
import { StorageService } from '@/services/storage';

export default function SplashScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(async () => {
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
    }, 1500);

    return () => clearTimeout(timer);
  }, [fadeAnim, router]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.logoContainer}>
          <Leaf size={64} color={colors.surface} strokeWidth={2.5} />
        </View>
        <Text style={styles.title}>GreenLoop</Text>
        <Text style={styles.subtitle}>Rewards & More</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.surface,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
