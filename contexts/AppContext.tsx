import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { StorageService } from '@/services/storage';
import { TrackingService } from '@/services/tracking';
import { CampaignService } from '@/services/campaigns';
import { useAuth } from './AuthContext';
import { MOCK_REWARDS } from '@/mocks/rewards';
import { cartBadge } from '@/lib/cartBadge';
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
  const [cartCount, setCartCountInternal] = useState<number>(cartBadge.get());

  useEffect(() => {
    console.log('[AppContext] Subscribing to cartBadge');
    const unsub = cartBadge.on((n) => {
      console.log('[AppContext] cartBadge emitted:', n);
      setCartCountInternal(n);
    });
    return () => {
      console.log('[AppContext] Unsubscribing from cartBadge');
      unsub();
    };
  }, []);

  const setCartCount = useCallback((count: number | null) => {
    console.log('[AppContext] setCartCount called with:', count);
    cartBadge.set(count);
  }, []);

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

  return useMemo(() => ({
    transactions,
    rewards,
    campaigns,
    isLoading,
    shopUrl,
    setShopUrl,
    cartCount,
    setCartCount,
    refreshTransactions,
    refreshCampaigns,
    addPoints,
    redeemReward,
    redeemCode,
  }), [transactions, rewards, campaigns, isLoading, shopUrl, cartCount, setCartCount, refreshTransactions, refreshCampaigns, addPoints, redeemReward, redeemCode]);
});
