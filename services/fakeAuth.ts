import AsyncStorage from '@react-native-async-storage/async-storage';
import { REVIEW_BUILD, REVIEW_DEMO_FAKE_AUTH } from '@/constants/config';

const KEYS = {
  FAKE_SESSION: '@greenloop_fake_session',
};

export interface FakeSession {
  name: string;
  email: string;
  id: string;
  createdAt: number;
}

export const FakeAuthService = {
  /**
   * Check if fake auth is enabled
   */
  isEnabled(): boolean {
    return REVIEW_BUILD && REVIEW_DEMO_FAKE_AUTH;
  },

  /**
   * Get the fake session (Apple Reviewer profile)
   */
  async getSession(): Promise<FakeSession | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const data = await AsyncStorage.getItem(KEYS.FAKE_SESSION);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[FakeAuth] Failed to get session:', error);
      return null;
    }
  },

  /**
   * Initialize the fake reviewer session
   */
  async initSession(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const existing = await this.getSession();
      if (existing) {
        console.log('[FakeAuth] Session already exists');
        return;
      }

      const session: FakeSession = {
        name: 'Apple Reviewer',
        email: 'reviewer@demo.greenhaus.app',
        id: 'reviewer-demo-' + Date.now(),
        createdAt: Date.now(),
      };

      await AsyncStorage.setItem(KEYS.FAKE_SESSION, JSON.stringify(session));
      console.log('[FakeAuth] ✅ Fake session initialized:', session.email);
    } catch (error) {
      console.error('[FakeAuth] Failed to init session:', error);
    }
  },

  /**
   * Clear the fake session (sign out)
   */
  async clearSession(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      await AsyncStorage.removeItem(KEYS.FAKE_SESSION);
      console.log('[FakeAuth] Session cleared');
    } catch (error) {
      console.error('[FakeAuth] Failed to clear session:', error);
    }
  },

  /**
   * Check if user is "signed in" (has fake session)
   */
  async isSignedIn(): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    const session = await this.getSession();
    return session !== null;
  },
};

