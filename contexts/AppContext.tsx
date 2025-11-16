import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StorageService } from '@/services/storage';
import { TrackingService } from '@/services/tracking';
import { CampaignService } from '@/services/campaigns';
import { useAuth } from './AuthContext';
import { MOCK_REWARDS } from '@/mocks/rewards';
import { cartBadge } from '@/lib/cartBadge';
import { cartState } from '@/lib/cartState';
import type { Transaction, Reward, Campaign } from '@/types';
import { debugLog } from '@/lib/logger';

interface AppState {
  transactions: Transaction[];
  rewards: Reward[];
  campaigns: Campaign[];
  isLoading: boolean;
  shopUrl: string;
  setShopUrl: (url: string) => void;
  cartCount: number;
  setCartCount: (count: number | null, confirmed?: boolean) => void;
  onboardingCompleted: boolean;
  selectedStoreId: string | null;
  lastKnownState: string | null;
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  setSelectedStoreId: (id: string | null) => Promise<void>;
  setLastKnownState: (state: string | null) => Promise<void>;
  clearOnboarding: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  refreshCampaigns: () => Promise<void>;
  addPoints: (points: number, description: string, campaignId?: string) => Promise<void>;
  redeemReward: (reward: Reward) => Promise<void>;
  redeemCode: (code: string) => Promise<{ success: boolean; points?: number; message: string }>;
}

export const [AppProvider, useApp] = createContextHook<AppState>(() => {
  const { user, updateUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rewards] = useState<Reward[]>(MOCK_REWARDS);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [shopUrl, setShopUrl] = useState<string>('https://greenhauscc.com/products');
  const CART_COUNT_KEY = '@greenloop_cart_count';
  const [cartCount, setCartCountInternal] = useState<number>(0);
  const [onboardingCompleted, setOnboardingCompletedState] = useState<boolean>(false);
  const [selectedStoreId, setSelectedStoreIdState] = useState<string | null>(null);
  const [lastKnownState, setLastKnownStateState] = useState<string | null>(null);

  const hydrationRef = useRef(false);
  const zeroCountTimerRef = useRef<NodeJS.Timeout | null>(null);

  const persistCartCount = useCallback(async (value: number) => {
    try {
      await AsyncStorage.setItem(CART_COUNT_KEY, String(value));
      debugLog('[AppContext] 💾 Persisted cart count:', value);
    } catch (error) {
      debugLog('[AppContext] ⚠️ Failed to persist cart count:', error);
    }
  }, []);

  const hydrateCartCount = useCallback(async () => {
    if (hydrationRef.current) return;
    hydrationRef.current = true;
    try {
      const stored = await AsyncStorage.getItem(CART_COUNT_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          const normalized = Math.min(999, parsed);
          debugLog('[AppContext] 🧰 Async hydrated cart count:', normalized);
          
          // CRITICAL: Update cartBadge FIRST before setting internal state
          // This ensures the badge has the correct value when listeners subscribe
          cartBadge.set(normalized);
          debugLog('[AppContext] ✅ Set cartBadge to hydrated value:', normalized);
          
          setCartCountInternal(normalized);
        }
      }
    } catch (error) {
      debugLog('[AppContext] ⚠️ Async hydrate failed:', error);
    }
  }, []);

  useEffect(() => {
    hydrateCartCount();
  }, [hydrateCartCount]);

  // Subscribe to cartBadge changes to keep state in sync
  useEffect(() => {
    const unsubscribe = cartBadge.on((count) => {
      debugLog('[AppContext] 📢 cartBadge update received:', count);
      setCartCountInternal(count);
      persistCartCount(count);
    });
    return unsubscribe;
  }, [persistCartCount]);

  const setCartCount = useCallback((count: number | null, confirmed: boolean = false) => {
    debugLog('[AppContext] 🔄 setCartCount called with:', count, 'type:', typeof count, 'confirmed:', confirmed);
    if (count === null || count === undefined) {
      debugLog('[AppContext] ⏭️ Skipping null/undefined count');
      return;
    }
    const normalized = Math.max(0, Math.min(999, Math.floor(count)));
    const currentCount = cartBadge.get();

    // Clear any pending zero count timer
    if (zeroCountTimerRef.current) {
      clearTimeout(zeroCountTimerRef.current);
      zeroCountTimerRef.current = null;
    }

    // If trying to set to 0 when we have items in cart:
    // - Cart tab (confirmed): Trust immediately
    // - Other tabs (unconfirmed): Delay 3 seconds to ensure page is fully loaded
    if (normalized === 0 && currentCount > 0 && !confirmed) {
      debugLog('[AppContext] ⏸️ Delaying 0 count update - will apply in 3s if page is actually empty');

      zeroCountTimerRef.current = setTimeout(() => {
        debugLog('[AppContext] ⏰ 3s delay passed - applying 0 count (cart likely empty)');
        cartBadge.set(0);
        setCartCountInternal(prev => {
          if (prev === 0) return prev;
          persistCartCount(0);
          return 0;
        });
        zeroCountTimerRef.current = null;
      }, 3000);
      return;
    }

    // For non-zero counts or confirmed zeros, update immediately
    debugLog('[AppContext] 📤 Updating cartBadge with:', normalized, confirmed ? '(confirmed)' : '(immediate)');
    cartBadge.set(normalized);

    // Also update internal state directly for immediate UI update
    setCartCountInternal(prev => {
      if (prev === normalized) {
        debugLog('[AppContext] ⏭️ Cart count unchanged, skipping state update');
        return prev;
      }
      debugLog('[AppContext] ✅ Updating cart count from', prev, 'to', normalized);
      persistCartCount(normalized);
      return normalized;
    });
  }, [persistCartCount]);

  const refreshTransactions = useCallback(async () => {
    if (!user) return;
    const txs = await StorageService.getTransactions();
    const userTxs = txs.filter(t => t.userId === user.id);
    setTransactions(userTxs);
  }, [user]);

  const refreshCampaigns = useCallback(async () => {
    const camps = await CampaignService.getCampaigns();
    setCampaigns(camps);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        debugLog('AppContext: Starting initialization');
        
        // CRITICAL: Hydrate cart state EARLY so it's available before WebView loads
        // This ensures cart persistence across app restarts
        debugLog('[AppContext] 🛒 Hydrating cart state from storage...');
        await cartState.hydrateFromStorage();
        const cartSnapshot = cartState.get();
        if (cartSnapshot) {
          debugLog('[AppContext] ✅ Cart state hydrated - cartId:', cartSnapshot.local?.['PSecwid__86917525PScart'] ? 'present' : 'missing');
        } else {
          debugLog('[AppContext] ℹ️ No cart state found in storage');
        }
        
        const state = await StorageService.getOnboardingState();
        setOnboardingCompletedState(state?.completedOnboarding || false);
        setSelectedStoreIdState(state?.activeStoreId || null);
        setLastKnownStateState(state?.state || null);
        debugLog('[AppContext] Loaded onboarding state:', state);
        
        await CampaignService.initializeCampaigns();
        await refreshTransactions();
        await refreshCampaigns();
        debugLog('AppContext: Initialization complete');
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [refreshTransactions, refreshCampaigns]);

  const addPoints = useCallback(async (
    points: number,
    description: string,
    campaignId?: string
  ) => {
    if (!user) return;

    const newTransaction: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      type: 'earned',
      points,
      description,
      campaignId,
      date: new Date(),
    };

    await StorageService.addTransaction(newTransaction);
    await updateUser({ points: user.points + points });
    await refreshTransactions();

    debugLog(`✅ Added ${points} points: ${description}`);
  }, [user, updateUser, refreshTransactions]);

  const redeemReward = useCallback(async (reward: Reward) => {
    if (!user || user.points < reward.pointsCost) return;

    const newTransaction: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      type: 'redeemed',
      points: -reward.pointsCost,
      description: `Redeemed: ${reward.title}`,
      date: new Date(),
    };

    await StorageService.addTransaction(newTransaction);
    await updateUser({ points: user.points - reward.pointsCost });
    await refreshTransactions();

    debugLog(`✅ Redeemed reward: ${reward.title}`);
  }, [user, updateUser, refreshTransactions]);

  const redeemCode = useCallback(async (
    code: string
  ): Promise<{ success: boolean; points?: number; message: string }> => {
    if (!user) {
      return { success: false, message: 'Please sign in first' };
    }

    const validation = await CampaignService.validateCode(code, user.id, user.tier);
    
    if (!validation.valid || !validation.campaign) {
      return { success: false, message: validation.message };
    }

    const campaign = validation.campaign;

    await addPoints(
      campaign.pointsReward,
      `Campaign: ${campaign.name}`,
      campaign.id
    );

    await StorageService.incrementCampaignRedemption(user.id, campaign.id);

    await TrackingService.logEvent('code_redeemed', user.id, {
      campaignId: campaign.id,
      code: campaign.code,
      points: campaign.pointsReward,
    });

    return {
      success: true,
      points: campaign.pointsReward,
      message: `${campaign.pointsReward} points added!`,
    };
  }, [user, addPoints]);

  const setOnboardingCompleted = useCallback(async (completed: boolean) => {
    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ...existing,
      ageVerified: existing?.ageVerified || false,
      state: existing?.state || null,
      stateSupported: existing?.stateSupported || false,
      activeStoreId: existing?.activeStoreId || null,
      completedOnboarding: completed,
    });
    setOnboardingCompletedState(completed);
    debugLog('[AppContext] Onboarding completed:', completed);
  }, []);

  const setSelectedStoreId = useCallback(async (id: string | null) => {
    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ...existing,
      ageVerified: existing?.ageVerified || false,
      state: existing?.state || null,
      stateSupported: existing?.stateSupported || false,
      activeStoreId: id,
      completedOnboarding: existing?.completedOnboarding || false,
    });
    setSelectedStoreIdState(id);
    debugLog('[AppContext] Selected store ID:', id);
  }, []);

  const setLastKnownState = useCallback(async (state: string | null) => {
    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ...existing,
      ageVerified: existing?.ageVerified || false,
      state: state,
      stateSupported: existing?.stateSupported || false,
      activeStoreId: existing?.activeStoreId || null,
      completedOnboarding: existing?.completedOnboarding || false,
    });
    setLastKnownStateState(state);
    debugLog('[AppContext] Last known state:', state);
  }, []);

  const clearOnboarding = useCallback(async () => {
    await StorageService.saveOnboardingState({
      ageVerified: false,
      state: null,
      stateSupported: false,
      activeStoreId: null,
      completedOnboarding: false,
    });
    setOnboardingCompletedState(false);
    setSelectedStoreIdState(null);
    setLastKnownStateState(null);
    debugLog('[AppContext] Onboarding cleared');
  }, []);

  return useMemo(() => ({
    transactions,
    rewards,
    campaigns,
    isLoading,
    shopUrl,
    setShopUrl,
    cartCount,
    setCartCount,
    onboardingCompleted,
    selectedStoreId,
    lastKnownState,
    setOnboardingCompleted,
    setSelectedStoreId,
    setLastKnownState,
    clearOnboarding,
    refreshTransactions,
    refreshCampaigns,
    addPoints,
    redeemReward,
    redeemCode,
  }), [transactions, rewards, campaigns, isLoading, shopUrl, cartCount, setCartCount, onboardingCompleted, selectedStoreId, lastKnownState, setOnboardingCompleted, setSelectedStoreId, setLastKnownState, clearOnboarding, refreshTransactions, refreshCampaigns, addPoints, redeemReward, redeemCode]);
});
