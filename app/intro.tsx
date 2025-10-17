import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StorageService } from '@/services/storage';

export default function IntroScreen() {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const navigating = useRef(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleContinue = useCallback(async () => {
    if (navigating.current) return;
    navigating.current = true;
    await StorageService.setIntroSeen(true);
    router.replace('/age-gate');
  }, [router]);

  useEffect(() => {
    if (!imageLoaded) return;

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
  }, [handleContinue, opacity, scale, imageLoaded]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity, transform: [{ scale }] }]}>
        <Image
          source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/nrkgvzgs6iujt20c9jdch' }}
          style={styles.logo}
          resizeMode="contain"
          onLoad={() => setImageLoaded(true)}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    width: 360,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },

});
