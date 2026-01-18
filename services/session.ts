/**
 * Session Management Service
 * Tracks user sessions and prevents duplicate APP_OPEN events
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLog } from '@/lib/logger';

const SESSION_STORAGE_KEY = '@greenloop:session';
const APP_OPEN_FIRED_KEY = '@greenloop:app_open_fired';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface Session {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  userId?: string;
  events: string[];
  appOpenFired?: boolean; // Track if APP_OPEN was fired for this session
}

// Import analytics here to avoid circular dependency issues
let trackAnalyticsEvent: ((eventType: string, metadata?: any, userId?: string | null) => void) | null = null;

// Lazy load analytics to avoid circular imports
const getTrackAnalyticsEvent = () => {
  if (!trackAnalyticsEvent) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    trackAnalyticsEvent = require('./analytics').trackAnalyticsEvent;
  }
  return trackAnalyticsEvent!;
};

class SessionService {
  private currentSession: Session | null = null;
  private sessionInitialized = false;
  private appOpenFiredThisLaunch = false; // In-memory flag for this app launch

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
    // Reset the in-memory flag for new sessions
    this.appOpenFiredThisLaunch = false;

    return {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      lastActivity: Date.now(),
      userId,
      events: [],
      appOpenFired: false,
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

  /**
   * Initialize session and fire tracking events
   * This is the main entry point - handles all tracking logic to prevent duplicates
   */
  async initializeSessionWithTracking(userId?: string): Promise<{
    session: Session;
    isNewSession: boolean;
    didFireAppOpen: boolean;
  }> {
    debugLog(`🔄 [SessionService] initializeSessionWithTracking called, userId=${userId || 'anonymous'}`);

    // Load existing session
    const storedSession = await this.loadSession();
    const isValidSession = storedSession && this.isSessionValid(storedSession);

    let isNewSession = false;
    let didFireAppOpen = false;
    let shouldFireAppOpen = false;

    if (isValidSession) {
      // Resume existing session
      debugLog('✅ [SessionService] Resuming valid session:', storedSession!.sessionId, 'appOpenFired:', storedSession!.appOpenFired);
      this.currentSession = {
        ...storedSession!,
        lastActivity: Date.now(),
        userId: userId || storedSession!.userId,
      };

      // Only fire APP_OPEN if not already fired for this session
      shouldFireAppOpen = !storedSession!.appOpenFired;
    } else {
      // Create new session - always fire APP_OPEN for new sessions
      debugLog('🆕 [SessionService] Creating new session');
      this.currentSession = this.createNewSession(userId);
      isNewSession = true;
      shouldFireAppOpen = true;
    }

    // Fire APP_OPEN only once per session (persisted check)
    if (shouldFireAppOpen && !this.currentSession.appOpenFired) {
      debugLog(`📱 [SessionService] Firing APP_OPEN for userId: ${userId || 'anonymous'}`);
      getTrackAnalyticsEvent()('APP_OPEN', {}, userId);
      this.currentSession.appOpenFired = true;
      didFireAppOpen = true;

      // Fire SESSION_START only for new sessions
      if (isNewSession) {
        debugLog(`🆕 [SessionService] Firing SESSION_START for userId: ${userId || 'anonymous'}`);
        getTrackAnalyticsEvent()('SESSION_START', {}, userId);
      }

      // Save immediately after firing to persist the flag
      await this.saveSession(this.currentSession);
    } else {
      debugLog('⏭️ [SessionService] APP_OPEN already fired for this session, skipping');
    }

    this.sessionInitialized = true;

    return { session: this.currentSession, isNewSession, didFireAppOpen };
  }

  /**
   * Update session with user ID (when user logs in)
   * Returns true if session was updated
   */
  async updateSessionUser(userId: string): Promise<boolean> {
    if (!this.currentSession) {
      debugLog('⚠️ [SessionService] Cannot update user: No current session');
      return false;
    }

    // Only update if user actually changed
    if (this.currentSession.userId === userId) {
      debugLog('⏭️ [SessionService] User already set, skipping update');
      return false;
    }

    debugLog('👤 [SessionService] Updating session user to:', userId);
    this.currentSession.userId = userId;
    this.currentSession.lastActivity = Date.now();
    await this.saveSession(this.currentSession);
    return true;
  }

  /**
   * Handle app returning to foreground
   */
  async handleForeground(userId?: string): Promise<void> {
    debugLog('📱 [SessionService] handleForeground called');

    // Check if session timed out
    if (this.currentSession && !this.isSessionValid(this.currentSession)) {
      debugLog('🆕 [SessionService] Session timed out, starting new session');
      this.currentSession = this.createNewSession(userId);
      await this.saveSession(this.currentSession);
      getTrackAnalyticsEvent()('SESSION_START', {}, userId);
    } else if (this.currentSession) {
      debugLog('✅ [SessionService] Session still valid, updating activity');
      this.currentSession.lastActivity = Date.now();
      await this.saveSession(this.currentSession);
    }
  }
}

export const sessionService = new SessionService();
