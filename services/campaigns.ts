import { StorageService } from './storage';
import type { Campaign } from '@/types';

export const DEFAULT_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp_new_customer',
    name: 'New Customer Welcome',
    code: 'WELCOME2025',
    pointsReward: 500,
    description: 'Welcome bonus for new customers',
    active: true,
    maxRedemptionsPerUser: 1,
  },
  {
    id: 'camp_reorder',
    name: 'Reorder Bonus',
    code: 'REORDER',
    pointsReward: 200,
    description: 'Bonus points for repeat purchases',
    active: true,
  },
  {
    id: 'camp_vip',
    name: 'VIP Exclusive',
    code: 'VIP2025',
    pointsReward: 1000,
    description: 'Exclusive for Gold & Platinum members',
    active: true,
    maxRedemptionsPerUser: 5,
  },
];

export const CampaignService = {
  async initializeCampaigns(): Promise<void> {
    const existing = await StorageService.getCampaigns();
    if (existing.length === 0) {
      await StorageService.saveCampaigns(DEFAULT_CAMPAIGNS);
      console.log('✅ Campaigns initialized');
    }
  },

  async getCampaigns(): Promise<Campaign[]> {
    return StorageService.getCampaigns();
  },

  async addCampaign(campaign: Omit<Campaign, 'id'>): Promise<Campaign> {
    const campaigns = await StorageService.getCampaigns();
    const newCampaign: Campaign = {
      ...campaign,
      id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    campaigns.push(newCampaign);
    await StorageService.saveCampaigns(campaigns);
    return newCampaign;
  },

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<void> {
    const campaigns = await StorageService.getCampaigns();
    const index = campaigns.findIndex(c => c.id === id);
    if (index !== -1) {
      campaigns[index] = { ...campaigns[index], ...updates };
      await StorageService.saveCampaigns(campaigns);
    }
  },

  async deleteCampaign(id: string): Promise<void> {
    const campaigns = await StorageService.getCampaigns();
    const filtered = campaigns.filter(c => c.id !== id);
    await StorageService.saveCampaigns(filtered);
  },

  async validateCode(
    code: string,
    userId: string,
    userTier: string
  ): Promise<{ valid: boolean; campaign?: Campaign; message: string }> {
    const campaigns = await StorageService.getCampaigns();
    const campaign = campaigns.find(
      c => c.active && c.code.toUpperCase() === code.toUpperCase()
    );

    if (!campaign) {
      return { valid: false, message: 'Invalid code' };
    }

    if (campaign.expiresAt && campaign.expiresAt < new Date()) {
      return { valid: false, message: 'This code has expired' };
    }

    if (campaign.maxRedemptionsPerUser) {
      const redeemed = await StorageService.getRedeemedCampaigns(userId);
      const count = redeemed[campaign.id] || 0;
      if (count >= campaign.maxRedemptionsPerUser) {
        return { valid: false, message: 'You have already used this code' };
      }
    }

    if (campaign.code === 'VIP2025' && userTier !== 'gold' && userTier !== 'platinum') {
      return { valid: false, message: 'VIP codes require Gold or Platinum tier' };
    }

    return { valid: true, campaign, message: 'Code validated successfully' };
  },
};
