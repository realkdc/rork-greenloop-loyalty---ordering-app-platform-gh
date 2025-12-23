import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert, Platform, Linking, Modal, TextInput } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";
import { webviewRefs } from "./_layout";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { submitAccountDeletionRequest } from "@/services/accountDeletion";
import { getPlatformConfig } from "@/constants/config";

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

const getInjectScript = (isAndroidGooglePlay: boolean) => `
  (function() {
    const style = document.createElement('style');
    style.textContent = \`${INJECTED_CSS}\`;
    document.head.appendChild(style);

    // Platform detection for Google Play compliance
    const isAndroidGooglePlay = ${isAndroidGooglePlay};

    // Hide headers, footers, and breadcrumbs
    function hideUIElements() {
      ['header', 'footer', 'nav', '.site-header', '.site-footer', '.ins-header', '.ec-footer', '.breadcrumbs', '.ec-breadcrumbs'].forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          el.style.display = 'none';
        });
      });

      // Block "Start Shopping" and similar CTA buttons on Google Play version
      if (isAndroidGooglePlay) {
        // Block links and buttons that navigate to shopping
        document.querySelectorAll('a, button').forEach(el => {
          const text = (el.textContent || '').toLowerCase();
          const href = (el.getAttribute('href') || '').toLowerCase();

          if (
            text.includes('start shopping') ||
            text.includes('shop now') ||
            text.includes('browse') ||
            text.includes('continue shopping') ||
            text.includes('view products') ||
            text.includes('shop our') ||
            href.includes('/products') ||
            href.includes('/shop') ||
            href.includes('/browse') ||
            href.includes('/catalog') ||
            href.includes('#!/products') ||
            href.includes('#!/shop')
          ) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
          }
        });
      }
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

    // Track successful logins (detect auth cookies or logged-in state)
    let hasTrackedLogin = false;

    function checkLoginStatus() {
      // Skip if already tracked
      if (hasTrackedLogin) return;

      // Check for auth cookies
      const cookies = document.cookie;
      const hasAuthCookie = /ec_auth_token|auth_token|login_token/.test(cookies);

      // Check for logged-in indicators on the page
      const accountElements = document.querySelectorAll('.account-dashboard, .customer-info, [data-user-name], .account-name, .user-profile, .logged-in');
      const hasAccountElements = accountElements.length > 0;

      // Check localStorage for auth tokens
      const hasStorageAuth = localStorage.getItem('ec_auth_token') || localStorage.getItem('auth_token');

      // If user is logged in, send signup event
      if ((hasAuthCookie || hasStorageAuth) && hasAccountElements) {
        console.log('[Auth] Login detected - sending signup event');
        hasTrackedLogin = true;

        try {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'USER_LOGGED_IN',
            timestamp: Date.now()
          }));
        } catch(err) {
          console.log('[Auth] Error posting USER_LOGGED_IN', err);
        }
      }
    }

    // Check login status periodically
    setInterval(checkLoginStatus, 2000);

    // Check on URL changes (magic link applied)
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(checkLoginStatus, 1000);
      }
    }, 500);
  })();
  true;
`;

export default function ProfileTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.profile = ref;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const platformConfig = getPlatformConfig();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPasteButton, setShowPasteButton] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const hasAppliedLinkRef = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Block navigation to transactional pages on Google Play version
  const handleShouldStartLoadWithRequest = useCallback((request: WebViewNavigation) => {
    const url = request.url || '';

    if (platformConfig.informationalOnly) {
      // Allow account page and auth-related pages
      if (url.includes('/account') || url.includes('greenhauscc.com/') && !url.includes('/products')) {
        return true;
      }

      // Block cart, checkout, product pages
      const blockedPaths = ['/cart', '/checkout', '/products', '/place-order', '/payment', '#!/cart', '#!/checkout', '#!/product'];
      if (blockedPaths.some(path => url.toLowerCase().includes(path))) {
        console.log('[Profile] Blocked navigation to transactional page:', url);
        return false;
      }
    }

    return true;
  }, [platformConfig.informationalOnly]);

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

  const handleOpenMail = useCallback(async () => {
    if (Platform.OS === 'android') {
      // On Android, try common email apps in order of preference
      const emailApps = [
        { name: 'Gmail', url: 'googlegmail://' },
        { name: 'Outlook', url: 'ms-outlook://' },
        { name: 'Yahoo Mail', url: 'ymail://' },
        { name: 'Samsung Email', url: 'samsungemail://' },
      ];

      let opened = false;
      for (const app of emailApps) {
        try {
          const canOpen = await Linking.canOpenURL(app.url);
          if (canOpen) {
            await Linking.openURL(app.url);
            opened = true;
            break;
          }
        } catch (e) {
          console.log(`Cannot open ${app.name}`);
        }
      }

      if (!opened) {
        Alert.alert('Open Email App', 'Please open your email app manually to get the sign-in link.');
      }
    } else {
      // iOS - use message://
      const mailUrl = 'message://';
      try {
        const supported = await Linking.canOpenURL(mailUrl);
        if (supported) {
          await Linking.openURL(mailUrl);
        } else {
          Alert.alert('Cannot Open Mail', 'Please open your mail app manually to get the sign-in link.');
        }
      } catch (e) {
        Alert.alert('Cannot Open Mail', 'Please open your mail app manually to get the sign-in link.');
      }
    }
  }, []);

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data || '{}');

      if (msg.type === 'MAGIC_LINK_REQUESTED') {
        console.log('📧 Magic link requested - showing paste button');
        hasAppliedLinkRef.current = false;
        setTimeout(() => {
          setShowPasteButton(true);
        }, 1000);
      } else if (msg.type === 'USER_LOGGED_IN') {
        console.log('✅ User logged in - tracking signup event');

        // Send signup event to analytics
        const trackSignup = async () => {
          try {
            const event = {
              id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'signup',
              userId: user?.id || `guest_${Date.now()}`,
              metadata: {
                method: 'magic_link',
                source: 'webview',
              },
              timestamp: new Date().toISOString(),
            };

            console.log('📊 Sending signup event:', event);

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
        };

        trackSignup();
      }
    } catch (error) {
      console.error('Profile message error:', error);
    }
  }, [user]);

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
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        cacheEnabled={true}
        incognito={false}
        androidHardwareAccelerationDisabled={false}
        androidLayerType="hardware"
        pullToRefreshEnabled={true}
        injectedJavaScript={getInjectScript(platformConfig.informationalOnly)}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onLoadStart={() => {
          console.log('[Profile] Load started');
          setIsLoading(true);
        }}
        onLoadEnd={() => {
          console.log('[Profile] Load ended');
          setIsLoading(false);
          setRefreshing(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
          ref.current?.injectJavaScript(getInjectScript(platformConfig.informationalOnly));
        }}
        onError={(error) => {
          console.error('[Profile] WebView error:', error.nativeEvent);
          setIsLoading(false);
          setRefreshing(false);
        }}
        onHttpError={(error) => {
          console.error('[Profile] HTTP error:', error.nativeEvent);
          setIsLoading(false);
          setRefreshing(false);
        }}
        onMessage={handleMessage}
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
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

      <TouchableOpacity
        onPress={handleDeleteAccount}
        activeOpacity={0.85}
        style={[
          styles.deleteButton,
          {
            top: Math.max(insets.top, 16) + 10,
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
    </View>
  );
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
  deleteButton: {
    position: "absolute",
    right: 16,
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
});
