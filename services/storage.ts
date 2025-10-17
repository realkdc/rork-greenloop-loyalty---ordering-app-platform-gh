import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, Campaign, Event, Transaction, OnboardingState } from '@/types';

const KEYS = {
  USER: '@greenloop_user',
  CAMPAIGNS: '@greenloop_campaigns',
  EVENTS: '@greenloop_events',
  TRANSACTIONS: '@greenloop_transactions',
  REDEEMED_CAMPAIGNS: '@greenloop_redeemed_campaigns',
  ONBOARDING: '@greenloop_onboarding',
  INTRO_SEEN: '@greenloop_intro_seen',
};

export const StorageService = {
  async getUser(): Promise<User | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.USER);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        joinDate: new Date(parsed.joinDate),
      };
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  },

  async saveUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  },

  async getCampaigns(): Promise<Campaign[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.CAMPAIGNS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.map((c: any) => ({
        ...c,
        expiresAt: c.expiresAt ? new Date(c.expiresAt) : undefined,
      }));
    } catch (error) {
      console.error('Failed to get campaigns:', error);
      return [];
    }
  },

  async saveCampaigns(campaigns: Campaign[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.CAMPAIGNS, JSON.stringify(campaigns));
    } catch (error) {
      console.error('Failed to save campaigns:', error);
    }
  },

  async getEvents(): Promise<Event[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.EVENTS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      }));
    } catch (error) {
      console.error('Failed to get events:', error);
      return [];
    }
  },

  async addEvent(event: Event): Promise<void> {
    try {
      const events = await this.getEvents();
      events.push(event);
      await AsyncStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
    } catch (error) {
      console.error('Failed to add event:', error);
    }
  },

  async getTransactions(): Promise<Transaction[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.map((t: any) => ({
        ...t,
        date: new Date(t.date),
      }));
    } catch (error) {
      console.error('Failed to get transactions:', error);
      return [];
    }
  },

  async addTransaction(transaction: Transaction): Promise<void> {
    try {
      const transactions = await this.getTransactions();
      transactions.unshift(transaction);
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  },

  async getRedeemedCampaigns(userId: string): Promise<Record<string, number>> {
    try {
      const data = await AsyncStorage.getItem(`${KEYS.REDEEMED_CAMPAIGNS}_${userId}`);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to get redeemed campaigns:', error);
      return {};
    }
  },

  async incrementCampaignRedemption(userId: string, campaignId: string): Promise<void> {
    try {
      const redeemed = await this.getRedeemedCampaigns(userId);
      redeemed[campaignId] = (redeemed[campaignId] || 0) + 1;
      await AsyncStorage.setItem(`${KEYS.REDEEMED_CAMPAIGNS}_${userId}`, JSON.stringify(redeemed));
    } catch (error) {
      console.error('Failed to increment campaign redemption:', error);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(KEYS));
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  },

  async getIntroSeen(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEYS.INTRO_SEEN);
      return value === 'true';
    } catch (error) {
      console.error('Failed to get intro seen flag:', error);
      return false;
    }
  },

  async setIntroSeen(seen: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.INTRO_SEEN, seen ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to set intro seen flag:', error);
    }
  },

  async getOnboardingState(): Promise<OnboardingState | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.ONBOARDING);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get onboarding state:', error);
      return null;
    }
  },

  async saveOnboardingState(state: OnboardingState): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.ONBOARDING, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  },
};
