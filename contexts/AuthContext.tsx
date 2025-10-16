import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import { StorageService } from '@/services/storage';
import { TrackingService } from '@/services/tracking';
import { BRAND_CONFIG } from '@/constants/config';
import { getTierByPoints } from '@/constants/tiers';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, name?: string) => Promise<void>;
  signInWithPhone: (phone: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

export const [AuthProvider, useAuth] = createContextHook<AuthState>(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log('AuthContext: Loading user');
        const stored = await StorageService.getUser();
        if (stored) {
          setUser(stored);
          console.log('✅ User loaded:', stored.id);
        } else {
          console.log('AuthContext: No stored user, creating guest');
          await createGuestUser();
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        await createGuestUser();
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const createGuestUser = async () => {
    const guestUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Guest',
      email: '',
      phone: '',
      points: BRAND_CONFIG.loyalty.welcomeBonus,
      tier: 'bronze',
      referralCode: generateReferralCode(),
      joinDate: new Date(),
    };
    await StorageService.saveUser(guestUser);
    setUser(guestUser);
    console.log('✅ Guest user created:', guestUser.id);
  };

  const signIn = useCallback(async (email: string, name?: string) => {
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name || email.split('@')[0],
      email,
      phone: '',
      points: BRAND_CONFIG.loyalty.welcomeBonus,
      tier: 'bronze',
      referralCode: generateReferralCode(),
      joinDate: new Date(),
    };

    await StorageService.saveUser(newUser);
    setUser(newUser);

    await TrackingService.logEvent('signup', newUser.id, {
      method: 'email',
      welcomeBonus: BRAND_CONFIG.loyalty.welcomeBonus,
    });

    console.log('✅ User signed in:', newUser.id);
  }, []);

  const signInWithPhone = useCallback(async (phone: string, name?: string) => {
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name || 'User',
      email: '',
      phone,
      points: BRAND_CONFIG.loyalty.welcomeBonus,
      tier: 'bronze',
      referralCode: generateReferralCode(),
      joinDate: new Date(),
    };

    await StorageService.saveUser(newUser);
    setUser(newUser);

    await TrackingService.logEvent('signup', newUser.id, {
      method: 'phone',
      welcomeBonus: BRAND_CONFIG.loyalty.welcomeBonus,
    });

    console.log('✅ User signed in:', newUser.id);
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    console.log('✅ User signed out');
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;

    const updatedUser = { ...user, ...updates };
    
    if (updates.points !== undefined) {
      const newTier = getTierByPoints(updatedUser.points);
      updatedUser.tier = newTier.level;
    }

    await StorageService.saveUser(updatedUser);
    setUser(updatedUser);
  }, [user]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signInWithPhone,
    signOut,
    updateUser,
  };
});

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
