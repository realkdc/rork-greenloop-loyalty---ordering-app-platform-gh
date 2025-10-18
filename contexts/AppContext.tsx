import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StorageService } from '@/services/storage';
import { TrackingService } from '@/services/tracking';
import { CampaignService } from '@/services/campaigns';
import { useAuth } from './AuthContext';
import { MOCK_REWARDS } from '@/mocks/rewards';
import type { Transaction, Reward, Campaign } from '@/types';

interface AppState {
  transactions: Transaction[];
  rewards: Reward[];
  campaigns: Campaign[];
  isLoading: boolean;
  shopUrl: string;
  setShopUrl: (url: string) => void;
  cartCount: number;
  setCartCount: (count: number | null) => void;
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

  const persistCartCount = useCallback(async (value: number) => {
    try {
      await AsyncStorage.setItem(CART_COUNT_KEY, String(value));
      console.log('[AppContext] 💾 Persisted cart count:', value);
    } catch (error) {
      console.log('[AppContext] ⚠️ Failed to persist cart count:', error);
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
          console.log('[AppContext] 🧰 Async hydrated cart count:', normalized);
          setCartCountInternal(normalized);
        }
      }
    } catch (error) {
      console.log('[AppContext] ⚠️ Async hydrate failed:', error);
    }
  }, []);

  useEffect(() => {
    hydrateCartCount();
  }, [hydrateCartCount]);

  const setCartCount = useCallback((count: number | null) => {
    console.log('[AppContext] 🔄 setCartCount called with:', count, 'type:', typeof count);
    if (count === null || count === undefined) {
      console.log('[AppContext] ⏭️ Skipping null/undefined count');
      return;
    }
    const normalized = Math.max(0, Math.min(999, Math.floor(count)));
    setCartCountInternal(prev => {
      if (prev === normalized) {
        console.log('[AppContext] ⏭️ Cart count unchanged, skipping state update');
        return prev;
      }
      console.log('[AppContext] ✅ Updating cart count from', prev, 'to', normalized);
      persistCartCount(normalized);
      setTimeout(() => {
        console.log('[AppContext] 🔍 Verification - internal state is now:', normalized);
      }, 100);
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
        console.log('AppContext: Starting initialization');
        const state = await StorageService.getOnboardingState();
        setOnboardingCompletedState(state?.completedOnboarding || false);
        setSelectedStoreIdState(state?.activeStoreId || null);
        setLastKnownStateState(state?.state || null);
        console.log('[AppContext] Loaded onboarding state:', state);
        
        await CampaignService.initializeCampaigns();
        await refreshTransactions();
        await refreshCampaigns();
        console.log('AppContext: Initialization complete');
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

    console.log(`✅ Added ${points} points: ${description}`);
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

    console.log(`✅ Redeemed reward: ${reward.title}`);
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
    console.log('[AppContext] Onboarding completed:', completed);
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
    console.log('[AppContext] Selected store ID:', id);
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
    console.log('[AppContext] Last known state:', state);
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
    console.log('[AppContext] Onboarding cleared');
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
