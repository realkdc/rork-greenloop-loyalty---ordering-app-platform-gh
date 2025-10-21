import React, { useEffect, useState, useRef } from 'react';
import { AppState, Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { parseMagicLink } from '@/src/lib/auth/parseMagicLink';
import { useMagicLink } from '@/contexts/MagicLinkContext';

// In-memory cache to prevent duplicate prompts
const processedTokens = new Set<string>();
const CACHE_DURATION = 60000; // 60 seconds

export default function ClipboardLoginHandler() {
  const router = useRouter();
  const { setPendingMagicLink } = useMagicLink();
  const [isChecking, setIsChecking] = useState(false);
  const lastCheckRef = useRef<number>(0);

  const checkClipboard = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      const parsed = parseMagicLink(clipboardContent);
      
      if (parsed?.token) {
        const token = parsed.token;
        const now = Date.now();
        
        // Check if we've already processed this token recently
        if (processedTokens.has(token) && (now - lastCheckRef.current) < CACHE_DURATION) {
          return;
        }
        
        // Add to cache and update last check time
        processedTokens.add(token);
        lastCheckRef.current = now;
        
        // Clean old tokens from cache
        setTimeout(() => {
          processedTokens.delete(token);
        }, CACHE_DURATION);
        
        // Show confirmation modal
        Alert.alert(
          'Sign in with magic link?',
          'We found a magic link in your clipboard.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Continue',
              style: 'default',
              onPress: () => {
                // Set the magic link and let the existing flow handle it
                setPendingMagicLink(`key=${token}`);
                router.push('/(tabs)/profile');
              },
            },
          ]
        );
      }
    } catch (error) {
      // Handle iOS paste permission gracefully
      if (Platform.OS === 'ios' && error.message?.includes('permission')) {
        console.log('Clipboard access denied - this is normal on iOS');
      } else {
        console.warn('Failed to check clipboard:', error);
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check clipboard on mount
    checkClipboard();
    
    // Check clipboard when app comes to foreground
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        checkClipboard();
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  return null; // This component doesn't render anything
}
