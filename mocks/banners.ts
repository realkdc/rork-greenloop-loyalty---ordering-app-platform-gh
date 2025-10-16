export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  action: {
    type: 'navigate' | 'external';
    target: string;
  };
}

export const MOCK_BANNERS: Banner[] = [
  {
    id: 'b1',
    title: 'Double Points Weekend',
    subtitle: 'Earn 2x points on all purchases',
    imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800',
    action: {
      type: 'navigate',
      target: '/shop',
    },
  },
  {
    id: 'b2',
    title: 'New Arrivals',
    subtitle: 'Check out our latest products',
    imageUrl: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=800',
    action: {
      type: 'navigate',
      target: '/shop',
    },
  },
  {
    id: 'b3',
    title: 'Refer & Earn',
    subtitle: 'Get 200 points for each friend',
    imageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
    action: {
      type: 'navigate',
      target: '/account',
    },
  },
];

export interface QuickAction {
  id: string;
  title: string;
  icon: string;
  color: string;
  action: {
    type: 'navigate' | 'external';
    target: string;
  };
}

export const MOCK_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'qa1',
    title: 'Flower',
    icon: 'Leaf',
    color: '#10B981',
    action: {
      type: 'navigate',
      target: 'https://greenhauscc.com/products/Flower-c151502143',
    },
  },
  {
    id: 'qa2',
    title: 'Edibles',
    icon: 'Cookie',
    color: '#F59E0B',
    action: {
      type: 'navigate',
      target: 'https://greenhauscc.com/products/Edibles-c151502148',
    },
  },
  {
    id: 'qa3',
    title: 'Deals',
    icon: 'Tag',
    color: '#EF4444',
    action: {
      type: 'navigate',
      target: 'https://greenhauscc.com/products?filter=on-sale',
    },
  },
  {
    id: 'qa4',
    title: 'Scan QR',
    icon: 'QrCode',
    color: '#8B5CF6',
    action: {
      type: 'navigate',
      target: '/qr-scanner',
    },
  },
];
