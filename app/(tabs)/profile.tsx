import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Linking, Dimensions, AppState } from "react-native";
import type { WebView } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebShell } from "@/components/WebShell";
import { webviewRefs } from "./_layout";
import { useFocusEffect } from "@react-navigation/native";
import { Mail, Link2 } from "lucide-react-native";
import Colors from "@/constants/colors";
import { AUTH_CONFIG } from "@/config/authConfig";
import { parseMagicLink } from '@/src/lib/auth/parseMagicLink';
import { loginWithMagicLink } from '@/src/lib/auth/loginWithMagicLink';

const MAGIC_CONFIRM_SELECTORS = [
  '.ec-notification',
  '.ec-notice',
  '.ec-alert',
  '.ec-info-block',
  '.ec-store__notice',
  '.ec-popup__msg',
  '.notification',
  '.alert',
  '.message',
  '.toast',
  '.snackbar',
  '.ins-notification',
  '[role="alert"]',
  '[data-testid="magic-link-confirmation"]'
];

const CONFIRMATION_PATTERN_SOURCES = AUTH_CONFIG.confirmationTextPatterns.map(pattern => pattern.source);
const DEFAULT_HELPER_TOP = 168;

export default function ProfileTab() {
  const ref = useRef<WebView>(null);
  const [showHelper, setShowHelper] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [helperOffset, setHelperOffset] = useState<number>(DEFAULT_HELPER_TOP);
  const hasAppliedLinkRef = useRef<boolean>(false);
  const hasRequestedLinkRef = useRef<boolean>(false);
  const bannerDismissedRef = useRef<boolean>(false);
  const isLoggedInRef = useRef<boolean>(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimerDeadlineRef = useRef<number>(0);
  const screenHeightRef = useRef<number>(Dimensions.get("window").height);
  const toastVisibleRef = useRef<boolean>(false);
  const fallbackAttemptsRef = useRef<number>(0);
  const pendingClipboardCheckRef = useRef<boolean>(false);
  const appStateRef = useRef<string>(AppState.currentState || 'active');
  
  // New: Auto magic link state
  const triedClipboardThisSession = useRef<boolean>(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  
  webviewRefs.profile = ref;

  const applyMagicLink = useCallback((magicUrl: string) => {
    if (!ref.current || hasAppliedLinkRef.current) {
      console.log('❌ Cannot apply link: ref not available or already applied');
      return;
    }

    console.log('🔐 Applying magic link:', magicUrl);
    hasAppliedLinkRef.current = true;
    setShowHelper(false);

    const rawLink = magicUrl.trim();

    const buildDestination = (value: string) => {
      if (!value) {
        return `https://${AUTH_CONFIG.host}/products/account`;
      }

      if (/^https?:/i.test(value)) {
        return value;
      }

      if (value.startsWith('?')) {
        return `https://${AUTH_CONFIG.host}/products/account${value}`;
      }

      if (value.includes('=')) {
        const query = value.replace(/^\?/, '');
        return `https://${AUTH_CONFIG.host}/products/account?${query}`;
      }

      return `https://${AUTH_CONFIG.host}/products/account?key=${encodeURIComponent(value)}`;
    };

    const destination = buildDestination(rawLink);

    const safeDestination = destination
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");

    const applyScript = `
      (function(){
        try {
          const url = '${safeDestination}';
          console.log('[Auth] Navigating to magic link URL', url);
          window.location.replace(url);
        } catch(e){
          console.error('[Auth] Error applying magic link', e);
        }
      })();
      true;
    `;

    ref.current.injectJavaScript(applyScript);
  }, []);

  // New: Handle clipboard pull on "Get sign-in link" click
  const handleGetLinkClick = useCallback(async () => {
    const DEBUG = process.env.EXPO_PUBLIC_MAGICLINK_DEBUG === 'true';
    
    if (DEBUG) {
      console.log('🔍 [MagicLink Debug] Get sign-in link button clicked');
    }
    
    if (triedClipboardThisSession.current) {
      if (DEBUG) {
        console.log('🔍 [MagicLink Debug] Already tried clipboard this session, skipping');
      }
      console.log('🔒 Already tried clipboard this session, skipping');
      return;
    }

      // Check 10-minute cooldown
      try {
        const lastAttempt = await AsyncStorage.getItem('gh.magiclink.lastAttempt');
        if (lastAttempt) {
          const lastAttemptTime = parseInt(lastAttempt, 10);
          const now = Date.now();
          const tenMinutes = 10 * 60 * 1000;

          if (now - lastAttemptTime < tenMinutes) {
            if (DEBUG) {
              console.log('🔍 [MagicLink Debug] Within 10-minute cooldown, skipping');
            }
            console.log('🔒 Within 10-minute cooldown, skipping');
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to check cooldown:', error);
      }

    triedClipboardThisSession.current = true;
    pendingClipboardCheckRef.current = false;
    
    // Store attempt timestamp
    try {
      await AsyncStorage.setItem('gh.magiclink.lastAttempt', Date.now().toString());
    } catch (error) {
      console.warn('Failed to store attempt timestamp:', error);
    }

    if (DEBUG) {
      console.log('🔍 [MagicLink Debug] Reading clipboard after Get sign-in link click');
    }
    console.log('📋 Reading clipboard after Get sign-in link click');
    
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      if (DEBUG) {
        console.log('🔍 [MagicLink Debug] Clipboard content:', clipboardContent);
      }
      console.log('📋 Clipboard content:', clipboardContent);
      
      const parsed = parseMagicLink(clipboardContent);
      if (parsed?.token) {
        if (DEBUG) {
          console.log('🔍 [MagicLink Debug] Found magic link token:', parsed.token);
        }
        console.log('🎯 Found magic link token:', parsed.token);
        
        // Check if we've already processed this token
        try {
          const lastToken = await AsyncStorage.getItem('gh.magiclink.lastToken');
          const tokenHash = parsed.token.slice(0, 8); // Use first 8 chars as hash
          
          if (lastToken === tokenHash) {
            console.log('🔒 Token already processed recently, skipping');
            return;
          }
          
          // Store token hash
          await AsyncStorage.setItem('gh.magiclink.lastToken', tokenHash);
        } catch (error) {
          console.warn('Failed to check/store token:', error);
        }
        
        // Attempt login
        if (DEBUG) {
          console.log('🔍 [MagicLink Debug] Attempting login with token');
        }
        const success = await loginWithMagicLink(parsed.token, {
          webViewRef: ref as React.RefObject<WebView>,
          onSuccess: () => {
            if (DEBUG) {
              console.log('🔍 [MagicLink Debug] Auto magic link login successful');
            }
            console.log('✅ Auto magic link login dispatched, awaiting confirmation');
          },
          onError: (error) => {
            if (DEBUG) {
              console.log('🔍 [MagicLink Debug] Auto magic link login failed:', error);
            }
            console.error('❌ Auto magic link login failed:', error);
            setShowToast('Couldn\'t sign in from link. You can paste it in the banner.');
            setTimeout(() => setShowToast(null), 5000);
            triedClipboardThisSession.current = false;
          }
        });
        
        if (success && clipboardContent.includes('greenhauscc.com')) {
          // Clear clipboard if it was the exact magic link URL
          try {
            await Clipboard.setStringAsync('');
          } catch (error) {
            console.warn('Failed to clear clipboard:', error);
          }
        }
      } else {
        if (DEBUG) {
          console.log('🔍 [MagicLink Debug] No magic link token found in clipboard');
        }
        console.log('📋 No magic link token found in clipboard');
        setShowToast('Didn\'t find a link. Paste it manually.');
        setTimeout(() => setShowToast(null), 4000);
        triedClipboardThisSession.current = false;
        // Auto-paste disabled: pendingClipboardCheckRef.current = true;
      }
    } catch (error) {
      console.warn('Failed to read clipboard:', error);
      if (Platform.OS === 'ios' && error instanceof Error && error.message?.includes('permission')) {
        console.log('📋 Clipboard access denied - this is normal on iOS');
      }
      triedClipboardThisSession.current = false;
      // Auto-paste disabled: pendingClipboardCheckRef.current = true;
    }
  }, [ref]);

  const suppressMagicBanner = useCallback((isSuppressed: boolean) => {
    if (!ref.current) {
      return;
    }
    const script = `
      (function(){
        window.__ghMagicLinkState = window.__ghMagicLinkState || {};
        window.__ghMagicLinkState.suppressed = ${isSuppressed ? 'true' : 'false'};
        if (!window.__ghMagicLinkState.suppressed){
          window.__ghMagicLinkState.lastVisible = false;
          window.__ghMagicLinkState.lastRect = null;
        }
      })();
      true;
    `;
    ref.current.injectJavaScript(script);
  }, []);

  const clearBannerTimer = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    bannerTimerDeadlineRef.current = 0;
  }, []);

  const computeOffset = useCallback((rect?: { top?: number; bottom?: number; height?: number }) => {
    if (!rect) {
      return DEFAULT_HELPER_TOP;
    }
    const bottomFromRect =
      typeof rect.bottom === 'number'
        ? rect.bottom
        : typeof rect.top === 'number' && typeof rect.height === 'number'
          ? rect.top + rect.height
          : (rect.top ?? 0);
    const proposed = bottomFromRect + 36;
    return Math.min(Math.max(proposed, 60), screenHeightRef.current - 200);
  }, []);

  const lastToastRectRef = useRef<{ top?: number; bottom?: number; height?: number } | null>(null);

  const scheduleBannerFallback = useCallback((delay = 1200, fallbackOffset?: number) => {
    const now = Date.now();
    const target = now + delay;
    if (bannerTimerRef.current && bannerTimerDeadlineRef.current && bannerTimerDeadlineRef.current <= target) {
      return;
    }
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    if (!toastVisibleRef.current) {
      fallbackAttemptsRef.current = 0;
    }
    bannerTimerDeadlineRef.current = target;
    console.log(`[Auth] Scheduling helper banner in ${delay}ms`);
    bannerTimerRef.current = setTimeout(() => {
      bannerTimerRef.current = null;
      bannerTimerDeadlineRef.current = 0;

      if (!hasRequestedLinkRef.current || bannerDismissedRef.current || isLoggedInRef.current) {
        return;
      }

      let offset = typeof fallbackOffset === 'number'
        ? Math.min(Math.max(fallbackOffset, 60), screenHeightRef.current - 200)
        : computeOffset(lastToastRectRef.current || undefined);

      if (toastVisibleRef.current && lastToastRectRef.current) {
        offset = Math.min(
          Math.max((lastToastRectRef.current.bottom ?? 0) + 48, DEFAULT_HELPER_TOP + 12),
          screenHeightRef.current - 140
        );
      } else if (toastVisibleRef.current && !lastToastRectRef.current) {
        const toastAssumedBottom = DEFAULT_HELPER_TOP + 72;
        offset = Math.min(Math.max(toastAssumedBottom, 60), screenHeightRef.current - 140);
      }

      setHelperOffset(offset);
      setShowHelper(true);
      fallbackAttemptsRef.current = 0;
      console.log('[Auth] Helper banner displayed from fallback at offset', offset);
    }, delay);
  }, [computeOffset]);

  const updateHelperPosition = useCallback((rect?: { top?: number; bottom?: number; height?: number }) => {
    const offset = computeOffset(rect);
    console.log('[Auth] Helper position recalculated:', { offset, rect });
    setHelperOffset(offset);
  }, [computeOffset]);

  const startConfirmationProbe = useCallback(() => {
    if (!ref.current) {
      return;
    }
    const script = `
      (function(){
        try {
          const selectors = ${JSON.stringify(MAGIC_CONFIRM_SELECTORS)};
          const patternSources = ${JSON.stringify(CONFIRMATION_PATTERN_SOURCES)};
          const patterns = patternSources.map(function(src){
            try { return new RegExp(src, 'i'); } catch(_) { return null; }
          }).filter(Boolean);
          
          console.log('[AuthProbe] Installing confirmation probe. selectors=' + selectors.length + ', patterns=' + patterns.length);
          
          if (!patterns.length) {
            console.log('[AuthProbe] No confirmation patterns configured, skipping probe');
            return true;
          }
          
          window.__ghMagicProbeState = window.__ghMagicProbeState || { timer: null, attempt: 0, origin: 'initial' };
          
          function serializeRect(rect){
            if (!rect) return null;
            return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height, width: rect.width };
          }
          
          function matches(text){
            if (!text) return false;
            const normalized = text.trim();
            if (!normalized) return false;
            for (let i = 0; i < patterns.length; i++){
              if (patterns[i] && patterns[i].test(normalized)) {
                return true;
              }
            }
            return false;
          }
          
          function findMatch(){
            for (let s = 0; s < selectors.length; s++){
              const nodes = document.querySelectorAll(selectors[s]);
              for (let n = 0; n < nodes.length; n++){
                const node = nodes[n];
                if (!node) continue;
                const text = (node.innerText || node.textContent || '').trim();
                if (matches(text)) {
                  return { selector: selectors[s], rect: node.getBoundingClientRect(), text };
                }
              }
            }
            const bodyText = (document.body && document.body.innerText) ? document.body.innerText.trim() : '';
            if (matches(bodyText)) {
              return { selector: 'body', rect: null, text: bodyText };
            }
            return null;
          }
          
          function sendResult(payload){
            try{
              window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
            }catch(err){
              console.log('[AuthProbe] postMessage error', err);
            }
          }
          
          function runProbe(origin){
            const state = window.__ghMagicProbeState;
            if (state.timer){
              clearTimeout(state.timer);
              state.timer = null;
            }
            state.origin = origin || 'unknown';
            state.attempt = 0;
            console.log('[AuthProbe] Running probe (origin=' + state.origin + ')');
            
            function step(){
              const match = findMatch();
              if (match){
                console.log('[AuthProbe] Confirmation element found via ' + match.selector);
                sendResult({
                  type:'EMAIL_LINK_SENT',
                  confirmationVisible:true,
                  confirmationRect: serializeRect(match.rect)
                });
                state.timer = null;
                return;
              }
              state.attempt += 1;
              if (state.attempt >= 30){
                console.log('[AuthProbe] Probe exhausted without finding confirmation');
                sendResult({
                  type:'EMAIL_LINK_SENT',
                  confirmationVisible:false
                });
                state.timer = null;
                return;
              }
              const delay = state.attempt < 6 ? 350 : 900;
              state.timer = setTimeout(step, delay);
            }
            
            step();
          }
          
          window.__ghStartMagicProbe = runProbe;
          runProbe('initial');
        } catch (err) {
          console.log('[AuthProbe] Failed to initialize', err);
          try{
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type:'EMAIL_LINK_SENT',
              confirmationVisible:false,
              error: String(err && err.message ? err.message : err)
            }));
          }catch(_err){}
        }
        return true;
      })();
      true;
    `;
    ref.current.injectJavaScript(script);
  }, [ref]);


  const handleManualPaste = async () => {
    if (hasAppliedLinkRef.current) {
      console.log('❌ Link already applied, ignoring manual paste');
      return;
    }

    try {
      const clipboardContent = await Clipboard.getStringAsync();
      
      if (!clipboardContent) {
        Alert.alert('No Link Found', 'Your clipboard is empty. Please copy the sign-in link from your email first.');
        return;
      }

      // Use the new parseMagicLink function
      const parsed = parseMagicLink(clipboardContent);
      if (!parsed) {
        Alert.alert(
          'Invalid Link',
          'The clipboard does not contain a valid GreenHaus sign-in link. Please copy the link from your email and try again.'
        );
        return;
      }

      console.log('✅ Valid magic link from manual paste');
      
      applyMagicLink(`key=${parsed.token}`);
      
      // Set the flag after successful application
      hasAppliedLinkRef.current = true;
      clearBannerTimer();
      setShowHelper(false);
      toastVisibleRef.current = false;
      lastToastRectRef.current = null;
      fallbackAttemptsRef.current = 0;
      bannerDismissedRef.current = false;
    } catch (error) {
      console.error('Manual paste error:', error);
      Alert.alert('Error', 'Failed to read clipboard. Please try again.');
    }
  };

  const handleOpenMail = () => {
    const mailUrl = Platform.select({
      ios: 'message://',
      android: 'content://com.android.email.provider',
      default: 'mailto:',
    });
    
    Linking.canOpenURL(mailUrl).then((supported) => {
      if (supported) {
        Linking.openURL(mailUrl);
      } else {
        Alert.alert('Cannot Open Mail', 'Please open your mail app manually to get the sign-in link.');
      }
    });
  };

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data || '{}');
      
      switch (msg.type) {
        case 'gh:getlink_clicked': {
          console.log('[Auth] Get sign-in link button clicked from web:', msg.source);
          triedClipboardThisSession.current = false;
          pendingClipboardCheckRef.current = !isLoggedInRef.current;
          if (!isLoggedInRef.current) {
            handleGetLinkClick();
          }
          break;
        }
        case 'MAGIC_LINK_REQUESTED': {
          if (isLoggedInRef.current) {
            break;
          }
          console.log('[Auth] Magic link request detected from web:', msg.source);
          triedClipboardThisSession.current = false;
          // Auto-paste disabled: pendingClipboardCheckRef.current = true;
          hasRequestedLinkRef.current = true;
          bannerDismissedRef.current = false;
          lastToastRectRef.current = null;
          toastVisibleRef.current = false;
          fallbackAttemptsRef.current = 0;
          updateHelperPosition(undefined);
          clearBannerTimer();
          setShowHelper(false);
          startConfirmationProbe();
          scheduleBannerFallback(2000, DEFAULT_HELPER_TOP);
          // Auto-paste disabled: pendingClipboardCheckRef.current = true;
          break;
        }
        case 'EMAIL_LINK_SENT': {
        console.log('📧 Email link sent confirmation');
        hasAppliedLinkRef.current = false;
        triedClipboardThisSession.current = false;
        if (isLoggedInRef.current) {
          break;
        }
          hasRequestedLinkRef.current = true;
          bannerDismissedRef.current = false;
          const rect = msg.confirmationRect;
          if (rect) {
            lastToastRectRef.current = rect;
          }
          else {
            lastToastRectRef.current = null;
          }
          toastVisibleRef.current = !!msg.confirmationVisible;
        if (rect) {
          console.log('[Auth] Confirmation rect from web:', rect);
          updateHelperPosition(rect);
          clearBannerTimer();
          setShowHelper(true);
          // Auto-paste disabled: pendingClipboardCheckRef.current = true;
          fallbackAttemptsRef.current = 0;
        } else {
          updateHelperPosition(undefined);
          setShowHelper(true);
          // Auto-paste disabled: pendingClipboardCheckRef.current = true;
          scheduleBannerFallback(900, DEFAULT_HELPER_TOP + 36);
        }
          break;
        }
        case 'MAGIC_CONFIRMATION_VISIBILITY': {
          const visible = !!msg.visible;
          toastVisibleRef.current = visible;
          if (visible) {
            clearBannerTimer();
            if (msg.rect) {
              lastToastRectRef.current = msg.rect;
              updateHelperPosition(msg.rect);
            }
            setShowHelper(false);
            pendingClipboardCheckRef.current = false;
            fallbackAttemptsRef.current = 0;
          } else {
            clearBannerTimer();
            console.log('[Auth] Confirmation hidden signal received, evaluating helper banner');
            if (
              hasRequestedLinkRef.current &&
              !bannerDismissedRef.current &&
              !isLoggedInRef.current
            ) {
              setShowHelper(true);
              // Auto-paste disabled: pendingClipboardCheckRef.current = true;
              scheduleBannerFallback(900, computeOffset(lastToastRectRef.current || undefined));
              fallbackAttemptsRef.current = 0;
            }
          }
          break;
        }
        case 'AUTH_DEBUG': {
          console.log('[Auth][Web]', msg.label, msg.data || {});
          break;
        }
        case 'ACCOUNT_LOGIN_STATE': {
          const loggedIn = !!msg.loggedIn;
          if (loggedIn !== isLoggedInRef.current) {
            console.log(`[Auth] Account login state updated: ${loggedIn ? 'logged in' : 'guest'}`);
          }
          if (msg.debug) {
            console.log('[Auth] Account state signals:', msg.debug);
          }
          isLoggedInRef.current = loggedIn;
          if (loggedIn) {
            hasRequestedLinkRef.current = false;
            bannerDismissedRef.current = false;
            clearBannerTimer();
            setShowHelper(false);
            setHelperOffset(DEFAULT_HELPER_TOP);
            suppressMagicBanner(true);
            toastVisibleRef.current = false;
            fallbackAttemptsRef.current = 0;
          } else {
            suppressMagicBanner(false);
            if (
              hasRequestedLinkRef.current &&
              !bannerDismissedRef.current &&
              !isLoggedInRef.current
            ) {
              scheduleBannerFallback(1500, DEFAULT_HELPER_TOP);
            }
          }
          break;
        }
        case 'LOGIN_SUCCESS': {
          console.log('✅ Login success');
          isLoggedInRef.current = true;
          hasRequestedLinkRef.current = false;
          bannerDismissedRef.current = false;
          hasAppliedLinkRef.current = false;
          clearBannerTimer();
          setShowSuccess(true);
          setShowHelper(false);
          setHelperOffset(DEFAULT_HELPER_TOP);
          suppressMagicBanner(true);
          toastVisibleRef.current = false;
          fallbackAttemptsRef.current = 0;
          setTimeout(() => setShowSuccess(false), 3000);
          break;
        }
        default:
          break;
      }
    } catch (error) {
      console.error('Profile message error:', error);
    }
  }, [clearBannerTimer, computeOffset, handleGetLinkClick, scheduleBannerFallback, startConfirmationProbe, suppressMagicBanner, updateHelperPosition]);

  useFocusEffect(
    React.useCallback(() => {
      console.log('[Profile Tab] 👤 Focused - requesting cart count update');

      // Auto-paste disabled - users must manually tap "Paste Link" button
      // if (pendingClipboardCheckRef.current && !triedClipboardThisSession.current && !hasAppliedLinkRef.current) {
      //   console.log('[MagicLink] Running pending clipboard check on focus');
      //   handleGetLinkClick();
      // }
      // Auto-paste disabled: pendingClipboardCheckRef.current = false;

      ref.current?.injectJavaScript(`
        (function(){ 
          try{ 
            if (window.__ghCartCounter) {
              window.__ghCartCounter.active = true;
              window.postMessage(JSON.stringify({type: 'PING'}), '*');
            }
            window.dispatchEvent(new Event('focus')); 
          }catch(e){} 
          true; 
        })();
      `);
      
      return undefined;
    }, [handleGetLinkClick])
  );

  useEffect(() => {
    const handleAppStateChange = (nextState: string) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState.match(/inactive|background/) && nextState === 'active') {
        console.log('[MagicLink] App resumed from background');
        // Auto-paste disabled - users must manually tap "Paste Link" button
        // if (pendingClipboardCheckRef.current && !triedClipboardThisSession.current && !hasAppliedLinkRef.current) {
        //   console.log('[MagicLink] Running pending clipboard check on resume');
        //   handleGetLinkClick();
        // }
        // Auto-paste disabled: pendingClipboardCheckRef.current = false;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [handleGetLinkClick]);

  useEffect(() => {
    return () => {
      clearBannerTimer();
    };
  }, [clearBannerTimer]);

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url || '';
    
    console.log('🌐 Profile nav:', url);
    
    const isAccountPage = url.includes('/account') && !url.includes('/login');
    
    if (isAccountPage) {
      const loginCheckDelay = hasAppliedLinkRef.current ? 2500 : 1200;
      const loginCheckScript = `
        (() => {
          try {
            const hasUser = ${AUTH_CONFIG.successSelectors.map(
              sel => `!!document.querySelector('${sel}')`
            ).join(' || ') || 'false'};
            
            const bodyText = document.body.innerText || '';
            const hasLogoutText = /log\\s*\\.*\\s*out|sign\\s*\\.*\\s*out/i.test(bodyText);
            const hasOrdersText = /your\\s+orders|order\\s+history/i.test(bodyText);
            const hasWelcomeText = /welcome\\s+back|hi[,\\s]/i.test(bodyText);
            const hasGuestText = /guest\\s+account/i.test(bodyText);
            
            const hasLoginForm = !!document.querySelector('form[action*="login"], form[action*="signin"], form[action*="account"], input[type="email"][name*="email"], input#customer-email, input[name="customer[email]"], input[type="password"]');
            const hasAuthCookie = ${AUTH_CONFIG.cookieNames.length ? AUTH_CONFIG.cookieNames.map(name => `document.cookie.includes('${name}=')`).join(' || ') : 'false'};
            let hasAuthStorage = false;
            try {
              hasAuthStorage = Boolean(${AUTH_CONFIG.storageKeys.length ? AUTH_CONFIG.storageKeys.map(key => `(localStorage.getItem('${key}') || sessionStorage.getItem('${key}'))`).join(' || ') : 'false'});
            } catch (_storageError) {}
            
            let isLoggedIn = false;
            if (hasGuestText) {
              isLoggedIn = false;
            } else if (hasUser || hasOrdersText || hasWelcomeText) {
              isLoggedIn = true;
            } else if ((hasLogoutText && !hasLoginForm) || hasAuthCookie || hasAuthStorage) {
              isLoggedIn = true;
            }
            
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type:'ACCOUNT_LOGIN_STATE',
              loggedIn: isLoggedIn,
              debug: {
                hasUser,
                hasOrdersText,
                hasWelcomeText,
                hasLogoutText,
                hasGuestText,
                hasLoginForm,
                hasAuthCookie,
                hasAuthStorage
              }
            }));
            ${hasAppliedLinkRef.current ? `
              if (isLoggedIn) {
                window.ReactNativeWebView?.postMessage(JSON.stringify({type:'LOGIN_SUCCESS'}));
              }
            ` : ''}
            return true;
          } catch(e){
            console.error('[Auth] Check error:', e);
            return false;
          }
        })();
      `;
      setTimeout(() => {
        ref.current?.injectJavaScript(loginCheckScript);
      }, loginCheckDelay);
    }
  };

  return (
    <View style={styles.container}>
      <WebShell
        ref={ref}
        initialUrl={`https://${AUTH_CONFIG.host}/account`}
        tabKey="profile"
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
      />
      {showHelper && (
        <View style={[styles.helperBanner, { top: helperOffset }]}> 
          <View style={styles.bannerContent}>
            <Link2 size={20} color={Colors.primary} style={styles.icon} />
            <View style={styles.textContainer}>
              <Text style={styles.bannerTitle}>Got the sign-in link?</Text>
              <Text style={styles.bannerText}>Copy it from your email, then tap Paste</Text>
            </View>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.mailButton}
              onPress={handleOpenMail}
            >
              <Mail size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.pasteButton}
              onPress={handleManualPaste}
            >
              <Text style={styles.pasteButtonText}>Paste Link</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.dismissButton}
              onPress={() => {
                bannerDismissedRef.current = true;
                clearBannerTimer();
                setShowHelper(false);
                setHelperOffset(DEFAULT_HELPER_TOP);
              }}
            >
              <Text style={styles.dismissButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


      {showSuccess && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✓ Signed in successfully</Text>
        </View>
      )}

      {showToast && (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{showToast}</Text>
        </View>
      )}
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  helperBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 4,
  },
  bannerText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mailButton: {
    backgroundColor: Colors.primary,
    padding: 10,
    borderRadius: 8,
  },
  pasteButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    flex: 1,
    marginLeft: 8,
  },
  pasteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  dismissButtonText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '400' as const,
  },
  successBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  toastBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
});
