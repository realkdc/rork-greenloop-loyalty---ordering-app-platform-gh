import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { APP_CONFIG } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REVIEWER_UNLOCK_KEY = '@greenloop_reviewer_unlock';

export const DemoBanner: React.FC = () => {
  const [reviewerUnlocked, setReviewerUnlocked] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load reviewer unlock state on mount
  React.useEffect(() => {
    const loadUnlockState = async () => {
      try {
        const unlocked = await AsyncStorage.getItem(REVIEWER_UNLOCK_KEY);
        if (unlocked === 'true') {
          setReviewerUnlocked(true);
        }
      } catch (error) {
        console.error('[DemoBanner] Error loading unlock state:', error);
      }
    };
    loadUnlockState();
  }, []);

  if (!APP_CONFIG.DEMO_MODE) return null;

  const handleTripleTap = async () => {
    tapCount.current += 1;

    // Clear existing timer
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }

    // Reset tap count after 1 second
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, 1000);

    // Check for triple tap
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      
      const newState = !reviewerUnlocked;
      setReviewerUnlocked(newState);
      
      // Store in AsyncStorage
      await AsyncStorage.setItem(REVIEWER_UNLOCK_KEY, newState ? 'true' : 'false');
      
      Alert.alert(
        'Reviewer Mode',
        newState 
          ? '✅ Reviewer mode: Geo bypass ON\n\nAll location restrictions disabled for review.'
          : '❌ Reviewer mode: Geo bypass OFF',
        [{ text: 'OK' }],
        { cancelable: true }
      );
    }
  };

  return (
    <TouchableOpacity 
      style={styles.banner}
      onPress={handleTripleTap}
      activeOpacity={0.9}
    >
      <Text style={styles.text}>
        🎭 Demo Build — Browsing Only (Login & Checkout Disabled)
        {reviewerUnlocked && ' • Reviewer Unlocked'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
});

