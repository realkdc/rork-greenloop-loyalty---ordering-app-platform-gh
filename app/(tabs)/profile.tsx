import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert, Platform, Linking, Modal, TextInput, ScrollView, Animated } from "react-native";
import { WebView } from "react-native-webview";
import { webviewRefs } from "./_layout";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { submitAccountDeletionRequest } from "@/services/accountDeletion";
import { useScreenTime } from "@/hooks/useScreenTime";
import { lookupCustomer, type CustomerSegments } from "@/services/lightspeedCustomerLookup";
import { MOCK_REWARDS } from "@/mocks/rewards";

const INJECTED_CSS = `
  /* Hide header and footer */
  header, .ins-header, .site-header,
  footer, .site-footer, .ec-footer,
  nav, .navigation, .site-nav,
  .breadcrumbs, .ec-breadcrumbs {
    display: none !important;
  }

  body {
    padding-top: 20px !important;
  }
`;

const INJECT_SCRIPT = `
  (function() {
    const style = document.createElement('style');
    style.textContent = \`${INJECTED_CSS}\`;
    document.head.appendChild(style);

    // Hide headers, footers, and breadcrumbs
    function hideUIElements() {
      ['header', 'footer', 'nav', '.site-header', '.site-footer', '.ins-header', '.ec-footer', '.breadcrumbs', '.ec-breadcrumbs'].forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          el.style.display = 'none';
        });
      });
    }

    // Run immediately and on DOM changes
    hideUIElements();
    setInterval(hideUIElements, 1000);

    // Watch for DOM changes
    const observer = new MutationObserver(hideUIElements);
    observer.observe(document.body, { childList: true, subtree: true });

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

      // Method 1: Look for "Welcome, email@example.com!" pattern (exact Lightspeed format)
      const welcomeMatch = bodyText.match(/Welcome,\\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})!/i);
      if (welcomeMatch) return welcomeMatch[1];

      // Method 2: Look for "Welcome, email@example.com" without exclamation
      const welcomeMatch2 = bodyText.match(/Welcome,\\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/i);
      if (welcomeMatch2) return welcomeMatch2[1];

      // Method 3: Look for "Email\\nuser@example.com" pattern (Lightspeed account page)
      const emailLabelMatch = bodyText.match(/Email\\n([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/i);
      if (emailLabelMatch) return emailLabelMatch[1];

      // Method 4: Look for standalone email after "Email" word
      const emailAfterLabel = bodyText.match(/Email[^@]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/i);
      if (emailAfterLabel) return emailAfterLabel[1];

      // Method 5: Just find any email in the page
      const anyEmail = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/);
      if (anyEmail) return anyEmail[0];

      return null;
    }

    function checkLoginStatus() {
      // Skip if already tracked this session
      if (hasTrackedLogin) return;

      const bodyText = document.body.innerText || '';

      // Check if on account page and has welcome text
      const isOnAccountPage = window.location.href.includes('/account');
      const hasWelcomeText = bodyText.includes('Welcome,');
      const hasSignedInText = bodyText.includes('You have signed in');

      // Must be logged in
      if (!isOnAccountPage || (!hasWelcomeText && !hasSignedInText)) {
        return;
      }

      // Extract email
      const customerEmail = extractCustomerEmail();

      if (customerEmail && customerEmail !== lastSentEmail) {
        hasTrackedLogin = true;
        lastSentEmail = customerEmail;

        // Send message to React Native
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'USER_LOGGED_IN',
            email: customerEmail,
            timestamp: Date.now()
          }));
        } catch(err) {}
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

  // Track screen time
  useScreenTime('Profile', user?.uid);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPasteButton, setShowPasteButton] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const hasAppliedLinkRef = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Rewards UI state
  const [customerData, setCustomerData] = useState<CustomerSegments | null>(null);
  const [showRewards, setShowRewards] = useState(false);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const rewardsSlideAnim = useRef(new Animated.Value(1000)).current;

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
        pullToRefreshEnabled={true}
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

      {/* Rewards Toggle Button - only show if customer data available */}
      {customerData && !showRewards && (
        <TouchableOpacity
          onPress={() => {
            setShowRewards(true);
            Animated.spring(rewardsSlideAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          }}
          activeOpacity={0.85}
          style={[
            styles.rewardsToggleButton,
            {
              top: Math.max(insets.top, 16) + 10,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="View rewards"
        >
          <Ionicons name="gift-outline" size={16} color="#FFFFFF" />
          <Text style={styles.rewardsToggleLabel}>Rewards</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handleDeleteAccount}
        activeOpacity={0.85}
        style={[
          styles.deleteButton,
          {
            top: Math.max(insets.top, 16) + 10,
            right: customerData && !showRewards ? 100 : 16, // Adjust position if rewards button is visible
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Delete my account"
      >
        <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
        <Text style={styles.deleteButtonLabel}>Delete</Text>
      </TouchableOpacity>

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
              <Ionicons name="chevron-down" size={28} color="#1E4D3A" />
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
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{customerData.orderCount || 0}</Text>
                  <Text style={styles.statLabel}>Orders</Text>
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
                <Text style={styles.sectionTitle}>Your Tier: {customerData.tier}</Text>
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

            {/* Available Rewards */}
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
    'Seed': 'Welcome to GreenHaus! Start earning rewards with every purchase.',
    'Sprout': 'You\'re growing! Keep shopping to reach the next tier.',
    'Bloom': 'Blooming member! Enjoy exclusive perks and rewards.',
    'Evergreen': 'Top tier! You\'re part of our VIP community.',
    'Bud': 'Growing strong! You\'re on your way to premium benefits.',
  };
  return descriptions[tier] || 'Keep shopping to unlock more rewards!';
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
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E4D3A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
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
});
