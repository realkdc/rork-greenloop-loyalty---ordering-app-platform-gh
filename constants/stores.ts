import type { Store } from '@/types';

export const STORES: Store[] = [
  {
    id: 'greenhaus-cc-champaign',
    name: 'GreenHaus',
    address: '2205 S Neil St',
    city: 'Champaign',
    state: 'IL',
    lat: 40.0986,
    lng: -88.2434,
    menuUrl: 'https://greenhauscc.com/products',
    cartUrl: 'https://greenhauscc.com/cart',
    accountUrl: 'https://greenhauscc.com/account',
    ordersUrl: 'https://greenhauscc.com/account/orders',
    loginUrl: 'https://greenhauscc.com/account/login',
    hours: 'Mon-Sat 9AM-9PM, Sun 10AM-6PM',
  },
];

export const SUPPORTED_STATES = ['IL', 'NJ'] as const;
export type SupportedState = typeof SUPPORTED_STATES[number];

export const STATE_NAMES: Record<SupportedState, string> = {
  IL: 'Illinois',
  NJ: 'New Jersey',
};

export function getStoresByState(state: string): Store[] {
  return STORES.filter(s => s.state === state);
}

export function getStoreById(id: string): Store | undefined {
  return STORES.find(s => s.id === id);
}
