import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert, Platform, Linking, Modal, TextInput, ScrollView, Animated } from "react-native";
import { WebView } from "react-native-webview";
import { webviewRefs } from "./_layout";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { submitAccountDeletionRequest } from "@/services/accountDeletion";
import { lookupCustomer, type CustomerSegments } from "@/services/lightspeedCustomerLookup";
import { MOCK_REWARDS } from "@/mocks/rewards";
import { useRouter } from "expo-router";

const INJECTED_CSS = `
  /* Hide headers, footers, navs, breadcrumbs - comprehensive selectors */
  header,
  footer,
  nav,
  .ins-header,
  .site-header,
  .ec-header,
  .site-footer,
  .ec-footer,
  .navigation,
  .site-nav,
  .breadcrumbs,
  .ec-breadcrumbs,
  [role="banner"],
  [role="navigation"],
  [id*="tile-footer"],
  [id*="tile-header"],
  [id*="footer"],
  [class*="footer"],
  [class*="Footer"] {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    overflow: hidden !important;
  }

  body {
    padding-top: 0px !important;
    margin-top: 0px !important;
    padding-bottom: 0px !important;
    margin-bottom: 0px !important;
  }
`;

const INJECT_SCRIPT = `
  (function() {
    const style = document.createElement('style');
    style.textContent = ${JSON.stringify(INJECTED_CSS)};
    document.head.appendChild(style);

    // Hide headers, footers, navs, breadcrumbs - same approach as cart/home pages
    function hideUIElements() {
      var selectors = [
        'header', '.ins-header', '.site-header', '.ec-header',
        'footer', '.site-footer', '.ec-footer',
        'nav', '.navigation', '.site-nav',
        '.breadcrumbs', '.ec-breadcrumbs',
        '[role="banner"]', '[role="navigation"]',
        '[id*="tile-footer"]', '[id*="tile-header"]'
      ];
      
      for (var s = 0; s < selectors.length; s++) {
        var els = document.querySelectorAll(selectors[s]);
        for (var i = 0; i < els.length; i++) {
          els[i].style.display = 'none';
        }
      }

      // Hide menu grid items by finding parent containers with multiple menu items
      var quickLinkLabels = ['Search Products', 'My Account', 'Track Orders', 'Favorites', 'Shopping Bag', 'Gift Cards'];
      var sections = document.querySelectorAll('section, div, ul, nav');
      for (var i = 0; i < sections.length; i++) {
        var section = sections[i];
        var text = (section.textContent || '').trim();
        if (text.length > 50 && text.length < 500) {
          var matchCount = 0;
          for (var j = 0; j < quickLinkLabels.length; j++) {
            if (text.indexOf(quickLinkLabels[j]) !== -1) {
              matchCount++;
            }
          }
          if (matchCount >= 3) {
            section.style.display = 'none';
            if (section.parentElement) {
              section.parentElement.style.display = 'none';
            }
          }
        }
      }

      // Hide "Have questions? Contact us" section and footer text
      var allEls = document.querySelectorAll('*');
      for (var i = 0; i < allEls.length; i++) {
        var el = allEls[i];
        var text = (el.textContent || '').trim();
        
        if (text.length > 10 && text.length < 300) {
          var shouldHide = false;
          
          if (text === 'Have questions? Contact us' ||
              (text.indexOf('LEGAL') !== -1 && text.indexOf('LEGIT') !== -1 && text.indexOf('LONG-LASTING') !== -1) ||
              text === 'Greenhaus Cannabis Co.' ||
              text === 'Terms & Conditions' ||
              text === 'Report abuse') {
            shouldHide = true;
          }
          
          if (shouldHide) {
            el.style.display = 'none';
            var parent = el.parentElement;
            if (parent) {
              parent.style.display = 'none';
              var grandParent = parent.parentElement;
              if (grandParent && (grandParent.tagName === 'SECTION' || grandParent.tagName === 'FOOTER' || grandParent.tagName === 'DIV')) {
                grandParent.style.display = 'none';
              }
            }
          }
        }
      }
    }

    // Run immediately
    hideUIElements();

    // Watch for DOM changes with debouncing
    var hideTimeout;
    var observer = new MutationObserver(function() {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(hideUIElements, 100);
    });
    
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    // Magic link detection
    if (typeof window.__ghMagicLinkCooldown === 'undefined') {
      window.__ghMagicLinkCooldown = 0;
    }

    function triggerMagicLinkBanner(source) {
      const now = Date.now();
      if (now - window.__ghMagicLinkCooldown < 3000) {
        console.log('[Auth] Magic link detection suppressed - skipping (' + source + ')');
        return;
      }
      window.__ghMagicLinkCooldown = now;
      console.log('[Auth] Magic link request detected (' + source + ')');

      try {
        window.ReactNativeWebView?.postMessage(JSON.stringify({type:'MAGIC_LINK_REQUESTED', source: source, timestamp: now}));
      } catch(err) {
        console.log('[Auth] Error posting MAGIC_LINK_REQUESTED', err);
      }
    }

    // Watch for button clicks
    document.addEventListener('click', function(e) {
      const target = e.target;
      if (!target) return;

      const text = (target.textContent || '').toLowerCase();
      const href = (target.getAttribute('href') || '').toLowerCase();
      const onclick = (target.getAttribute('onclick') || '').toLowerCase();

      // Check if it's a sign-in link button
      if (
        /get.*sign.*in.*link|send.*sign.*in.*link|magic.*link/i.test(text) ||
        /sign-?in-?link|magic-?link/i.test(href) ||
        /sign-?in|magic-?link/i.test(onclick)
      ) {
        console.log('[Auth] Sign-in link button clicked');
        setTimeout(() => triggerMagicLinkBanner('button-click'), 500);
      }
    }, true);

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const promise = originalFetch.apply(this, args);
      const url = args[0]?.toString() || '';

      if (/sign.*in.*link|magic.*link|auth.*email/i.test(url)) {
        promise.then(response => {
          if (response.ok) {
            setTimeout(() => triggerMagicLinkBanner('fetch'), 500);
          }
          return response;
        }).catch(() => {});
      }

      return promise;
    };

    // Send a test message to confirm WebView communication works
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'WEBVIEW_LOADED',
        url: window.location.href,
        timestamp: Date.now()
      }));
    } catch(e) {}

    // Track successful logins (detect auth cookies or logged-in state)
    let hasTrackedLogin = false;
    let lastSentEmail = null;

    function extractCustomerEmail() {
      const bodyText = document.body.innerText || '';

      // Method 1: Look for "Email" heading followed by email address (but not "Edit")
      // Match pattern: "Email\n[email]\nEdit" and extract just the email
      const emailSectionMatch = bodyText.match(/Email[\\s\\n]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})[\\s\\n]*(?:Edit)?/i);
      if (emailSectionMatch) {
        const cleanEmail = emailSectionMatch[1].replace(/Edit$/i, '').trim();
        console.log('[Auth] Found email via Email section:', cleanEmail);
        return cleanEmail;
      }

      // Method 2: Look for "Welcome, email@example.com!" pattern (exact Lightspeed format)
      const welcomeMatch = bodyText.match(/Welcome,\\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})!/i);
      if (welcomeMatch) return welcomeMatch[1];

      // Method 3: Look for "Welcome, email@example.com" without exclamation
      const welcomeMatch2 = bodyText.match(/Welcome,\\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/i);
      if (welcomeMatch2) return welcomeMatch2[1];

      // Method 4: Look for "Email\\nuser@example.com" pattern (Lightspeed account page)
      const emailLabelMatch = bodyText.match(/Email\\n([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/i);
      if (emailLabelMatch) return emailLabelMatch[1];

      // Method 5: Just find any email in the page
      const anyEmail = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/);
      if (anyEmail) {
        console.log('[Auth] Found email via generic search:', anyEmail[0]);
        return anyEmail[0];
      }

      return null;
    }

    function checkLoginStatus() {
      // Skip if already tracked this session
      if (hasTrackedLogin) return;

      const bodyText = document.body.innerText || '';

      // Check if on account page
      const isOnAccountPage = window.location.href.includes('/account');
      if (!isOnAccountPage) return;

      // Extract email first
      const customerEmail = extractCustomerEmail();

      // If we found an email on the account page, assume logged in
      if (customerEmail && customerEmail !== lastSentEmail) {
        console.log('[Auth] Login detected! Email:', customerEmail);
        hasTrackedLogin = true;
        lastSentEmail = customerEmail;

        // Send message to React Native
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'USER_LOGGED_IN',
            email: customerEmail,
            timestamp: Date.now()
          }));
          console.log('[Auth] Posted USER_LOGGED_IN message to React Native');
        } catch(err) {
          console.error('[Auth] Error posting message:', err);
        }
      } else {
        console.log('[Auth] No email found yet, will retry...');
      }
    }

    // Check immediately and every 2 seconds
    setTimeout(checkLoginStatus, 500);
    setTimeout(checkLoginStatus, 1500);
    setTimeout(checkLoginStatus, 3000);
    setInterval(checkLoginStatus, 2000);

    // Reset on URL change
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        hasTrackedLogin = false;
        setTimeout(checkLoginStatus, 500);
        setTimeout(checkLoginStatus, 1500);
      }
    }, 500);
  })();
  true;
`;

export default function ProfileTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.profile = ref;
  const insets = useSafeAreaInsets();
  const { user, signIn, updateUser } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPasteButton, setShowPasteButton] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const hasAppliedLinkRef = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://greenhauscc.com/account');

  // Rewards UI state
  const [customerData, setCustomerData] = useState<CustomerSegments | null>(null);
  const [showRewards, setShowRewards] = useState(false);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const rewardsSlideAnim = useRef(new Animated.Value(1000)).current;

  // Determine if we're on the main account page (not a sub-page like /account/edit)
  // Main page: /account or /account/ (with optional query params or hash)
  // Sub-pages: /account/edit, /account/addresses, etc.
  const isMainAccountPage = currentUrl === 'https://greenhauscc.com/account' || 
                           currentUrl === 'https://greenhauscc.com/account/' ||
                           (currentUrl.includes('/account') && 
                            !currentUrl.match(/\/account\/[^\/?#]+/) && 
                            !currentUrl.match(/\/account#/));

  // Force hide spinner after 8 seconds if WebView is stuck
  useEffect(() => {
    if (isLoading) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('[Profile] Loading timeout - forcing spinner to hide');
        setIsLoading(false);
        setRefreshing(false);
      }, 8000);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [isLoading]);

  // Fetch customer data from Lightspeed
  const fetchCustomerData = useCallback(async (email: string) => {
    setIsLoadingCustomer(true);
    try {
      console.log('🔍 [Profile] Fetching customer data for:', email);

      const data = await lookupCustomer(email);

      if (data) {
        console.log('✅ [Profile] Customer data loaded:', data);
        setCustomerData(data);

        // Show rewards UI after a brief delay
        setTimeout(() => {
          setShowRewards(true);
          Animated.spring(rewardsSlideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();
        }, 500);
      } else {
        console.log('❌ [Profile] No customer data found');
      }
    } catch (error) {
      console.error('❌ [Profile] Error fetching customer data:', error);
    } finally {
      setIsLoadingCustomer(false);
    }
  }, [rewardsSlideAnim]);

  // Auto-fetch customer data if user is already logged in
  useEffect(() => {
    // Get email from user object - try email field first, then uid
    const userEmail = user?.email || user?.uid;

    console.log('🔄 [Profile] Auto-fetch check:', {
      userEmail,
      hasCustomerData: !!customerData,
      isLoadingCustomer,
      showRewards,
    });

    // Check if user has email and we haven't loaded customer data yet
    if (userEmail && userEmail.includes('@') && !customerData && !isLoadingCustomer && !showRewards) {
      console.log('🔄 [Profile] User already logged in, auto-fetching customer data for:', userEmail);
      fetchCustomerData(userEmail);
    }
  }, [user?.email, user?.uid, customerData, isLoadingCustomer, showRewards, fetchCustomerData]);

  const handleManualPaste = useCallback(async () => {
    try {
      console.log('[Paste] Starting manual paste...');
      const clipboardContent = await Clipboard.getStringAsync();
      console.log('[Paste] Clipboard content length:', clipboardContent?.length || 0);

      if (!clipboardContent) {
        console.log('[Paste] Clipboard is empty');
        Alert.alert('No Link Found', 'Your clipboard is empty. Please copy the sign-in link from your email first.');
        return;
      }

      // Check if it looks like a magic link
      console.log('[Paste] Checking if link is valid...');
      console.log('[Paste] Contains greenhauscc.com:', clipboardContent.includes('greenhauscc.com'));
      console.log('[Paste] Contains key=:', clipboardContent.includes('key='));

      if (!clipboardContent.includes('greenhauscc.com') || !clipboardContent.includes('key=')) {
        console.log('[Paste] Invalid magic link format');
        Alert.alert(
          'Invalid Link',
          'The clipboard does not contain a valid GreenHaus sign-in link. Please copy the link from your email and try again.'
        );
        return;
      }

      console.log('✅ [Paste] Valid magic link detected');
      console.log('[Paste] Link URL:', clipboardContent.substring(0, 50) + '...');
      hasAppliedLinkRef.current = true;
      setShowPasteButton(false);

      const applyScript = `
        (function(){
          try {
            console.log('[Auth] Starting navigation to magic link');
            const url = '${clipboardContent.replace(/'/g, "\\'")}';
            console.log('[Auth] Target URL:', url.substring(0, 50) + '...');
            window.location.href = url;
            console.log('[Auth] Navigation command executed');
          } catch(e){
            console.error('[Auth] Navigation error:', e);
          }
        })();
        true;
      `;

      console.log('[Paste] Injecting navigation script...');
      ref.current?.injectJavaScript(applyScript);
      console.log('[Paste] Script injected successfully');

      setTimeout(() => {
        hasAppliedLinkRef.current = false;
      }, 10000);
    } catch (error) {
      console.error('[Paste] Error during manual paste:', error);
      Alert.alert('Error', 'Failed to read clipboard. Please try again.');
    }
  }, []);

  const handleOpenMail = useCallback(() => {
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
  }, []);

  const handleMessage = useCallback(async (event: any) => {
    try {
      const rawData = event.nativeEvent.data || '{}';
      console.log('📨📨📨 [Profile] RAW WebView message:', rawData.substring(0, 200));

      const msg = JSON.parse(rawData);
      console.log('📨 [Profile] Parsed message type:', msg.type);

      if (msg.type === 'WEBVIEW_LOADED') {
        // WebView communication confirmed working
        return;
      }

      if (msg.type === 'MAGIC_LINK_REQUESTED') {
        hasAppliedLinkRef.current = false;
        setTimeout(() => {
          setShowPasteButton(true);
        }, 1000);
      } else if (msg.type === 'USER_LOGGED_IN') {
        const customerEmail = msg.email;

        if (!customerEmail) {
          return;
        }

        // Sign in with email
        try {
          await signIn(customerEmail);
        } catch (error) {
          // Silently fail
        }

        // Fetch customer data from Lightspeed
        await fetchCustomerData(customerEmail);

        // Send signup event to analytics with email as userId
        try {
          const event = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'signup',
            userId: customerEmail, // Use email as userId for analytics tracking
            metadata: {
              method: 'magic_link',
              source: 'webview',
              email: customerEmail,
            },
            timestamp: new Date().toISOString(),
          };

          console.log('📊 Sending signup event with email as userId:', event);

          // Send to /api/events endpoint
          const response = await fetch('https://greenhaus-admin.vercel.app/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
          });

          if (response.ok) {
            console.log('✅ Signup event sent successfully');
          } else {
            console.warn('⚠️ Signup event failed:', response.status);
          }
        } catch (error) {
          console.error('❌ Error sending signup event:', error);
        }
      }
    } catch (error) {
      console.error('Profile message error:', error);
    }
  }, [user, signIn, fetchCustomerData]);

  const handleDeleteAccount = useCallback(() => {
    setShowDeleteModal(true);
    setDeleteEmail("");
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteEmail || deleteEmail.trim() === "") {
      Alert.alert("Email Required", "Please enter your email address to confirm account deletion.");
      return;
    }

    setIsSubmittingDelete(true);

    try {
      // Submit deletion request directly to Firestore
      await submitAccountDeletionRequest(deleteEmail.trim());

      // Close modal and show confirmation
      setShowDeleteModal(false);
      setDeleteEmail("");

      // Show success message
      Alert.alert(
        "Request Submitted",
        "Your account deletion request has been submitted. You will receive a confirmation email within 24-48 hours once your account has been deleted.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("[Account Deletion] Error:", error);
      Alert.alert(
        "Error",
        "Failed to submit deletion request. Please try again or contact support at greenhauscc@gmail.com.",
        [{ text: "OK" }]
      );
    } finally {
      setIsSubmittingDelete(false);
    }
  }, [deleteEmail]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setDeleteEmail("");
  }, []);

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5DB075" />
        </View>
      )}
      {/* Native header cover - hides the webview header (only on main account page, not sub-pages) */}
      {!showRewards && isMainAccountPage && (
        <View style={styles.headerCover} pointerEvents="none" />
      )}

      <WebView
        ref={ref}
        source={{ uri: 'https://greenhauscc.com/account' }}
        style={styles.webview}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled={true}
        incognito={false}
        pullToRefreshEnabled={false}
        bounces={false}
        injectedJavaScriptBeforeContentLoaded={`
          (function() {
            var style = document.createElement('style');
            style.textContent = ${JSON.stringify(INJECTED_CSS)};
            if (document.head) {
              document.head.appendChild(style);
            } else {
              document.addEventListener('DOMContentLoaded', function() {
                document.head.appendChild(style);
              });
            }
          })();
          true;
        `}
        injectedJavaScript={INJECT_SCRIPT}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => {
          setIsLoading(false);
          setRefreshing(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
          ref.current?.injectJavaScript(INJECT_SCRIPT);
        }}
        onError={() => {
          setIsLoading(false);
          setRefreshing(false);
        }}
        onHttpError={() => {
          setIsLoading(false);
          setRefreshing(false);
        }}
        onNavigationStateChange={(navState) => {
          setCurrentUrl(navState.url);
        }}
        onMessage={handleMessage}
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#5DB075" />
          </View>
        )}
        startInLoadingState={false}
      />

      {showPasteButton && (
        <View style={styles.helperBanner}>
          <View style={styles.textContainer}>
            <Text style={styles.bannerTitle}>📧 Check your email</Text>
            <Text style={styles.bannerText}>Copy the sign-in link, then tap Paste</Text>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.mailButton}
              onPress={handleOpenMail}
            >
              <Text style={styles.mailButtonText}>📬 Mail</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pasteButton}
              onPress={handleManualPaste}
            >
              <Text style={styles.pasteButtonText}>Paste Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => setShowPasteButton(false)}
            >
              <Text style={styles.dismissButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContainer}>
            <View style={styles.deleteModalHeader}>
              <Ionicons name="warning" size={48} color="#DC2626" />
              <Text style={styles.deleteModalTitle}>Delete Account Request</Text>
              <Text style={styles.deleteModalSubtitle}>
                Please enter your email address to submit a deletion request. You will receive a confirmation email within 24-48 hours once your account has been deleted.
              </Text>
            </View>

            <View style={styles.deleteModalBody}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.emailInput}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={deleteEmail}
                onChangeText={setDeleteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.deleteModalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelDelete}
                activeOpacity={0.7}
                disabled={isSubmittingDelete}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  isSubmittingDelete && styles.confirmDeleteButtonDisabled
                ]}
                onPress={handleConfirmDelete}
                activeOpacity={0.7}
                disabled={isSubmittingDelete}
              >
                {isSubmittingDelete ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>Confirm Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Rewards Button - shows when rewards are hidden but data exists */}
      {!showRewards && customerData && (
        <TouchableOpacity
          style={styles.floatingRewardsButton}
          onPress={() => {
            setShowRewards(true);
            Animated.spring(rewardsSlideAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          }}
        >
          <Ionicons name="gift" size={20} color="#FFFFFF" />
          <Text style={styles.floatingRewardsButtonText}>View Rewards</Text>
        </TouchableOpacity>
      )}

      {/* Native Rewards UI */}
      {showRewards && customerData && (
        <Animated.View
          style={[
            styles.rewardsContainer,
            {
              transform: [{ translateY: rewardsSlideAnim }],
            },
          ]}
        >
          <View style={[styles.rewardsHeader, { paddingTop: Math.max(insets.top, 16) + 10 }]}>
            <TouchableOpacity
              onPress={() => {
                // Navigate back to webview
                Animated.timing(rewardsSlideAnim, {
                  toValue: 1000,
                  duration: 300,
                  useNativeDriver: true,
                }).start(() => {
                  setShowRewards(false);
                });
              }}
              style={styles.closeRewardsButton}
            >
              <Ionicons name="chevron-back" size={24} color="#1E4D3A" />
            </TouchableOpacity>
            <Text style={styles.rewardsHeaderTitle}>Your Rewards</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.rewardsContent} showsVerticalScrollIndicator={false}>
            {/* Customer Info Card */}
            <View style={styles.customerCard}>
              <View style={styles.customerHeader}>
                <View>
                  <Text style={styles.customerName}>
                    {customerData.firstName} {customerData.lastName}
                  </Text>
                  <Text style={styles.customerEmail}>{customerData.email}</Text>
                </View>
                {customerData.tier && (
                  <View style={[styles.tierBadge, { backgroundColor: getTierColor(customerData.tier) }]}>
                    <Text style={styles.tierBadgeText}>{customerData.tier}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    ${(customerData.lifetimeValue || 0).toFixed(0)}
                  </Text>
                  <Text style={styles.statLabel}>Lifetime Value</Text>
                </View>

                {customerData.isVIP && (
                  <>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Ionicons name="star" size={24} color="#FFD700" />
                      <Text style={styles.statLabel}>VIP</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Tier Info */}
            {customerData.tier && (
              <View style={styles.tierInfoCard}>
                <Text style={styles.sectionTitle}>🌱 Crew Status: {customerData.tier}</Text>
                <Text style={styles.tierDescription}>
                  {getTierDescription(customerData.tier)}
                </Text>
                {getNextTierInfo(customerData.lifetimeValue || 0, customerData.tier) && (
                  <View style={styles.nextTierInfo}>
                    <Text style={styles.nextTierText}>
                      {getNextTierInfo(customerData.lifetimeValue || 0, customerData.tier)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Tier Perks */}
            {customerData.tier && (
              <View style={styles.rewardsSection}>
                <Text style={styles.sectionTitle}>Your Tier Benefits</Text>
                {getTierPerks(customerData.tier).map((perk, index) => (
                  <View key={index} style={styles.perkCard}>
                    <View style={styles.perkIconContainer}>
                      <Ionicons
                        name={
                          perk.type === 'discount' ? 'pricetag' :
                          perk.type === 'access' ? 'time' :
                          perk.type === 'service' ? 'star' :
                          'gift'
                        }
                        size={24}
                        color="#5DB075"
                      />
                    </View>
                    <View style={styles.perkInfo}>
                      <Text style={styles.perkTitle}>{perk.title}</Text>
                      <Text style={styles.perkDescription}>{perk.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* FUTURE: Point-based rewards system (currently using tier-based perks from Lightspeed)
            <View style={styles.rewardsSection}>
              <Text style={styles.sectionTitle}>Available Rewards</Text>
              {MOCK_REWARDS.filter(r => r.available).map((reward) => (
                <View key={reward.id} style={styles.rewardCard}>
                  <View style={styles.rewardInfo}>
                    <Text style={styles.rewardTitle}>{reward.title}</Text>
                    <Text style={styles.rewardDescription}>{reward.description}</Text>
                    <View style={styles.rewardFooter}>
                      <View style={styles.pointsBadge}>
                        <Ionicons name="star-outline" size={14} color="#5DB075" />
                        <Text style={styles.pointsText}>{reward.pointsCost} pts</Text>
                      </View>
                      <Text style={styles.rewardCategory}>{reward.category}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.redeemButton}>
                    <Text style={styles.redeemButtonText}>Redeem</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            */}

            {/* Account Settings Section */}
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>Account Settings</Text>

              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => {
                  // Navigate to orders tab
                  router.push('/(tabs)/orders');
                }}
              >
                <Ionicons name="receipt-outline" size={20} color="#1E4D3A" />
                <Text style={styles.settingsButtonText}>View Orders</Text>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => {
                  Animated.timing(rewardsSlideAnim, {
                    toValue: 1000,
                    duration: 300,
                    useNativeDriver: true,
                  }).start(() => {
                    setShowRewards(false);
                  });
                }}
              >
                <Ionicons name="settings-outline" size={20} color="#1E4D3A" />
                <Text style={styles.settingsButtonText}>Manage Account Details</Text>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingsButton, styles.deleteAccountButton]}
                onPress={handleDeleteAccount}
              >
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
                <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
                <Ionicons name="chevron-forward" size={20} color="#DC2626" />
              </TouchableOpacity>
            </View>

            {/* Bottom padding for scroll */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

// Helper functions for tier info
function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    'Seed': '#8B7355',
    'Sprout': '#5DB075',
    'Bloom': '#4CAF50',
    'Evergreen': '#1E4D3A',
    'Bud': '#7CB342',
  };
  return colors[tier] || '#6B7280';
}

function getTierDescription(tier: string): string {
  const descriptions: Record<string, string> = {
    'Seed': 'Welcome to the GreenHaus Crew! You\'ve planted your roots. Start stacking perks with every purchase.',
    'Sprout': 'You\'re growing fast, Crew! Keep shopping to unlock even more exclusive benefits.',
    'Bloom': 'Fully bloomed! Enjoy premium perks, early access, and exclusive drops as part of the Crew.',
    'Evergreen': 'You\'ve reached Evergreen, the top of the Crew. VIP status, VIP treatment, always.',
  };
  return descriptions[tier] || 'Welcome to the GreenHaus Crew! Keep shopping to unlock more rewards.';
}

function getTierPerks(tier: string): Array<{ title: string; description: string; type: string }> {
  const perks: Record<string, Array<{ title: string; description: string; type: string }>> = {
    'Seed': [
      { title: '10% Off Accessories & Drinks', description: 'Member pricing on smoking accessories and beverages', type: 'discount' },
      { title: 'Member-Only Drops', description: 'Early access to new products and special releases', type: 'access' },
      { title: 'App-First Promos', description: 'Exclusive promotions available only in the app', type: 'promo' },
    ],
    'Sprout': [
      { title: '$8 Off Orders $75+', description: 'Automatic cart discount on qualifying orders', type: 'discount' },
      { title: '12% Off Accessories & Drinks', description: 'Enhanced member pricing', type: 'discount' },
      { title: '24h Early Access', description: 'Shop drops and restocks a full day early', type: 'access' },
    ],
    'Bloom': [
      { title: '$12 Off Orders $100+', description: 'Automatic cart discount on qualifying orders', type: 'discount' },
      { title: '48h Early Access', description: 'Shop limited drops two days before everyone else', type: 'access' },
      { title: 'Hold Items 24h', description: 'Reserve products for pickup within 24 hours', type: 'service' },
      { title: 'Monthly Bundle Deal', description: 'Exclusive pre-built bundle promotion each month', type: 'promo' },
    ],
    'Evergreen': [
      { title: '$15 Off Orders $125+', description: 'Premium cart discount on qualifying orders', type: 'discount' },
      { title: '15% Off Accessories & Drinks', description: 'VIP member pricing', type: 'discount' },
      { title: 'VIP Private Drops', description: 'Exclusive access to limited-time products', type: 'access' },
      { title: 'Priority Support', description: 'Faster issue resolution and dedicated help', type: 'service' },
    ],
  };
  return perks[tier] || [];
}

function getNextTierInfo(lifetimeValue: number, currentTier: string): string | null {
  const tiers = [
    { name: 'Seed', minLtv: 0 },
    { name: 'Sprout', minLtv: 250 },
    { name: 'Bloom', minLtv: 750 },
    { name: 'Evergreen', minLtv: 1500 },
  ];

  const currentIndex = tiers.findIndex(t => t.name === currentTier);
  if (currentIndex === -1 || currentIndex === tiers.length - 1) return null;

  const nextTier = tiers[currentIndex + 1];
  const needed = nextTier.minLtv - lifetimeValue;

  if (needed > 0) {
    return `Spend $${needed.toFixed(0)} more to reach ${nextTier.name}!`;
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  headerCover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 85,
    backgroundColor: '#FFFFFF',
    zIndex: 500,
  },
  helperBanner: {
    position: 'absolute',
    top: 180,
    left: 30,
    right: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#1E4D3A',
  },
  textContainer: {
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  bannerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mailButton: {
    backgroundColor: '#1E4D3A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mailButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pasteButton: {
    flex: 1,
    backgroundColor: '#1E4D3A',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pasteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    color: '#6B7280',
    fontSize: 22,
    fontWeight: '300',
  },
  rewardsToggleButton: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#5DB075",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  rewardsToggleLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  debugButton: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#3B82F6",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  debugButtonLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  deleteButton: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#DC2626",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  deleteButtonLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 20, 13, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  deleteModalContainer: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    gap: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  deleteModalHeader: {
    alignItems: "center",
    gap: 12,
  },
  deleteModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#DC2626",
    textAlign: "center",
  },
  deleteModalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  deleteModalBody: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  deleteModalFooter: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
  },
  confirmDeleteButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmDeleteButtonDisabled: {
    opacity: 0.6,
  },
  // Rewards UI styles
  rewardsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F9FAFB',
    zIndex: 1001,
  },
  rewardsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeRewardsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  rewardsHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  rewardsContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  customerEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E4D3A',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#E5E7EB',
  },
  tierInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  tierDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  nextTierInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#5DB075',
  },
  nextTierText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E4D3A',
  },
  rewardsSection: {
    marginTop: 16,
  },
  perkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  perkIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  perkInfo: {
    flex: 1,
  },
  perkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  perkDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rewardInfo: {
    flex: 1,
    marginRight: 12,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  rewardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5DB075',
  },
  rewardCategory: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },
  redeemButton: {
    backgroundColor: '#1E4D3A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  redeemButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsSection: {
    marginTop: 20,
  },
  settingsButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingsButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E4D3A',
    marginLeft: 12,
  },
  deleteAccountButton: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
  },
  deleteAccountButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 12,
  },
  floatingRewardsButton: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: '#1E4D3A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  floatingRewardsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
