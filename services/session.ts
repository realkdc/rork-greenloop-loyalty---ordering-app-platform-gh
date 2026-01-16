/**
 * Session Management Service
 * Tracks user sessions and prevents duplicate APP_OPEN events
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '@/lib/logger';

const SESSION_STORAGE_KEY = '@greenloop:session';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface Session {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  userId?: string;
  events: string[];
}

class SessionService {
  private currentSession: Session | null = null;
  private sessionInitialized = false;

  /**
   * Initialize session on app start
   */
  async initializeSession(userId?: string): Promise<Session> {
    debugLog('🔄 [SessionService] Initializing session');

    // Load existing session from storage
    const storedSession = await this.loadSession();

    // Check if we have a valid session (within timeout)
    if (storedSession && this.isSessionValid(storedSession)) {
      debugLog('✅ [SessionService] Resuming existing session:', storedSession.sessionId);
      this.currentSession = {
        ...storedSession,
        lastActivity: Date.now(),
        userId: userId || storedSession.userId,
      };
    } else {
      debugLog('🆕 [SessionService] Creating new session');
      this.currentSession = this.createNewSession(userId);
    }

    // Save session to storage
    await this.saveSession(this.currentSession);
    this.sessionInitialized = true;

    return this.currentSession;
  }

  /**
   * Check if we should start a new session
   * Returns true if:
   * - No current session
   * - Session has timed out (30+ minutes of inactivity)
   * - User has changed
   */
  shouldStartNewSession(userId?: string): boolean {
    if (!this.currentSession) {
      debugLog('🆕 [SessionService] Should start new session: No current session');
      return true;
    }

    const timeSinceLastActivity = Date.now() - this.currentSession.lastActivity;
    if (timeSinceLastActivity > SESSION_TIMEOUT_MS) {
      debugLog('🆕 [SessionService] Should start new session: Session timeout');
      return true;
    }

    if (userId && this.currentSession.userId !== userId) {
      debugLog('🆕 [SessionService] Should start new session: User changed');
      return true;
    }

    debugLog('✅ [SessionService] Continuing current session');
    return false;
  }

  /**
   * Start a new session
   */
  async startNewSession(userId?: string): Promise<Session> {
    debugLog('🆕 [SessionService] Starting new session');
    this.currentSession = this.createNewSession(userId);
    await this.saveSession(this.currentSession);
    this.sessionInitialized = true;
    return this.currentSession;
  }

  /**
   * Update session activity
   */
  async updateActivity(): Promise<void> {
    if (!this.currentSession) {
      debugLog('⚠️ [SessionService] Cannot update activity: No current session');
      return;
    }

    this.currentSession.lastActivity = Date.now();
    await this.saveSession(this.currentSession);
  }

  /**
   * Track an event in the current session
   */
  async trackEvent(eventType: string): Promise<void> {
    if (!this.currentSession) {
      debugLog('⚠️ [SessionService] Cannot track event: No current session');
      return;
    }

    this.currentSession.events.push(eventType);
    this.currentSession.lastActivity = Date.now();
    await this.saveSession(this.currentSession);
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Check if session is initialized
   */
  isInitialized(): boolean {
    return this.sessionInitialized;
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    debugLog('🛑 [SessionService] Ending session');
    this.currentSession = null;
    this.sessionInitialized = false;
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  }

  // Private methods

  private createNewSession(userId?: string): Session {
    return {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      lastActivity: Date.now(),
      userId,
      events: [],
    };
  }

  private isSessionValid(session: Session): boolean {
    const timeSinceLastActivity = Date.now() - session.lastActivity;
    return timeSinceLastActivity < SESSION_TIMEOUT_MS;
  }

  private async loadSession(): Promise<Session | null> {
    try {
      const stored = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      debugLog('⚠️ [SessionService] Failed to load session:', error);
      return null;
    }
  }

  private async saveSession(session: Session): Promise<void> {
    try {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      debugLog('⚠️ [SessionService] Failed to save session:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const sessionService = new SessionService();
