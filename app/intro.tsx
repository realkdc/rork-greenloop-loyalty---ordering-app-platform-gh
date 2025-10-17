import { useCallback, useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';
import { StorageService } from '@/services/storage';

export default function IntroScreen() {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const navigating = useRef(false);

  const handleContinue = useCallback(async () => {
    if (navigating.current) return;
    navigating.current = true;
    await StorageService.setIntroSeen(true);
    router.replace('/age-gate');
  }, [router]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      handleContinue();
    }, 2200);

    return () => {
      clearTimeout(timer);
    };
  }, [handleContinue, opacity, scale]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity, transform: [{ scale }] }]}>
        <Image
          source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/59a66tzhlpbqockn595dw' }}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Text style={styles.tagline}>Elevating the GreenHaus experience</Text>

      <TouchableOpacity style={styles.skipButton} onPress={handleContinue} activeOpacity={0.85}>
        <Text style={styles.skipLabel}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    width: 280,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  tagline: {
    marginTop: 32,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  skipButton: {
    position: 'absolute',
    bottom: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  skipLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
