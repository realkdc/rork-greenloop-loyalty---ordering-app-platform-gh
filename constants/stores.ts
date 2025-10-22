import type { Store } from '@/types';

export const STORES: Store[] = [
  {
    id: 'greenhaus-tn-crossville',
    name: 'GreenHaus Cannabis Co.',
    address: 'Market Street',
    city: 'Crossville',
    state: 'TN',
    lat: 35.9481,
    lng: -85.0269,
    menuUrl: 'https://greenhauscc.com/products',
    cartUrl: 'https://greenhauscc.com/cart',
    accountUrl: 'https://greenhauscc.com/account',
    ordersUrl: 'https://greenhauscc.com/account/orders',
    loginUrl: 'https://greenhauscc.com/account/login',
    hours: 'Mon-Sat 9AM-9PM, Sun 10AM-6PM',
  },
  {
    id: 'greenhaus-tn-cookeville',
    name: 'GreenHaus Cannabis Co.',
    address: '456 University Ave',
    city: 'Cookeville',
    state: 'TN',
    lat: 36.1628,
    lng: -85.5016,
    menuUrl: 'https://greenhauscc.com/products',
    cartUrl: 'https://greenhauscc.com/cart',
    accountUrl: 'https://greenhauscc.com/account',
    ordersUrl: 'https://greenhauscc.com/account/orders',
    loginUrl: 'https://greenhauscc.com/account/login',
    hours: 'Mon-Sat 9AM-9PM, Sun 10AM-6PM',
  },
];

export const SUPPORTED_STATES = ['TN'] as const;
export type SupportedState = typeof SUPPORTED_STATES[number];

export const STATE_NAMES: Record<SupportedState, string> = {
  TN: 'Tennessee',
};

export function getStoresByState(state: string): Store[] {
  return STORES.filter(s => s.state === state);
}

export function getStoreById(id: string): Store | undefined {
  return STORES.find(s => s.id === id);
}
