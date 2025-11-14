import AsyncStorage from '@react-native-async-storage/async-storage';
import { REVIEW_BUILD, REVIEW_DEMO_FAKE_CHECKOUT } from '@/constants/config';

const KEYS = {
  FAKE_ORDERS: '@greenloop_fake_orders',
};

export interface FakeDemoOrder {
  id: string;
  status: 'Confirmed' | 'Processing' | 'Completed';
  storeName: string;
  total: string;
  subtotal: string;
  tax: string;
  createdAt: number;
  items: FakeDemoOrderItem[];
}

export interface FakeDemoOrderItem {
  name: string;
  quantity: number;
  price: string;
}

export const FakeDemoOrdersService = {
  /**
   * Check if fake checkout is enabled
   */
  isEnabled(): boolean {
    return REVIEW_BUILD && REVIEW_DEMO_FAKE_CHECKOUT;
  },

  /**
   * Get all fake demo orders
   */
  async getOrders(): Promise<FakeDemoOrder[]> {
    if (!this.isEnabled()) {
      return [];
    }

    try {
      const data = await AsyncStorage.getItem(KEYS.FAKE_ORDERS);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[FakeDemoOrders] Failed to get orders:', error);
      return [];
    }
  },

  /**
   * Add a new fake demo order
   */
  async addOrder(order: Omit<FakeDemoOrder, 'id' | 'createdAt'>): Promise<FakeDemoOrder> {
    if (!this.isEnabled()) {
      throw new Error('Fake checkout not enabled');
    }

    try {
      const orders = await this.getOrders();
      
      const newOrder: FakeDemoOrder = {
        ...order,
        id: 'demo-' + Date.now(),
        createdAt: Date.now(),
      };

      orders.unshift(newOrder); // Add to beginning
      await AsyncStorage.setItem(KEYS.FAKE_ORDERS, JSON.stringify(orders));
      
      console.log('[FakeDemoOrders] ✅ Order added:', newOrder.id);
      return newOrder;
    } catch (error) {
      console.error('[FakeDemoOrders] Failed to add order:', error);
      throw error;
    }
  },

  /**
   * Clear all fake orders
   */
  async clearOrders(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      await AsyncStorage.removeItem(KEYS.FAKE_ORDERS);
      console.log('[FakeDemoOrders] Orders cleared');
    } catch (error) {
      console.error('[FakeDemoOrders] Failed to clear orders:', error);
    }
  },

  /**
   * Initialize with a sample demo order if none exist
   */
  async initSampleOrder(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const existing = await this.getOrders();
      if (existing.length > 0) {
        console.log('[FakeDemoOrders] Sample order already exists');
        return;
      }

      const sampleOrder: Omit<FakeDemoOrder, 'id' | 'createdAt'> = {
        status: 'Confirmed',
        storeName: 'GreenHaus Demo Store',
        total: '$21.98',
        subtotal: '$20.00',
        tax: '$1.98',
        items: [
          {
            name: 'Hemp Flower Sample',
            quantity: 1,
            price: '$10.00',
          },
          {
            name: 'CBD Oil Tincture',
            quantity: 1,
            price: '$10.00',
          },
        ],
      };

      await this.addOrder(sampleOrder);
      console.log('[FakeDemoOrders] ✅ Sample order initialized');
    } catch (error) {
      console.error('[FakeDemoOrders] Failed to init sample order:', error);
    }
  },
};

