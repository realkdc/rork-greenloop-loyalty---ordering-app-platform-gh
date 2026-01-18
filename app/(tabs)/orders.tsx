import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert, Platform, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { webviewRefs } from "./_layout";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@/contexts/AuthContext";

const INJECTED_CSS = `
  /* Hide header, footer, nav */
  header, footer, nav,
  .ins-header, .site-header, .ec-header,
  .site-footer, .ec-footer,
  .breadcrumbs, .ec-breadcrumbs,
  .navigation, .site-nav {
    display: none !important;
  }

  body {
    padding-top: 0 !important;
    margin-top: 0 !important;
  }

  /* Hide horizontal rules/dividers */
  hr {
    display: none !important;
  }
`;

const INJECT_SCRIPT = `
  (function() {
    const style = document.createElement('style');
    style.textContent = ${JSON.stringify(INJECTED_CSS)};
    document.head.appendChild(style);

    function hideAccountShowOrders() {
      // Hide headers/footers/nav
      ['header', 'footer', 'nav'].forEach(tag => {
        document.querySelectorAll(tag).forEach(el => {
          el.style.display = 'none';
        });
      });

      // Find the "Orders" heading element
      let ordersHeading = null;
      document.querySelectorAll('h1, h2, h3, div, span').forEach(el => {
        const text = (el.textContent || '').trim();
        if (text === 'Orders' && !ordersHeading) {
          ordersHeading = el;
        }
      });

      if (ordersHeading) {
        // Find the container that holds the account info (everything above Orders)
        // Walk up to find a suitable parent, then hide siblings before it
        let container = ordersHeading;

        // Go up a few levels to find the main content container
        for (let i = 0; i < 5; i++) {
          if (container.parentElement) {
            container = container.parentElement;
          }
        }

        // Now find and hide elements that appear BEFORE the Orders section
        // by checking their position relative to the Orders heading
        const ordersRect = ordersHeading.getBoundingClientRect();

        document.querySelectorAll('*').forEach(el => {
          // Skip if element is or contains an image
          if (el.tagName === 'IMG' || el.querySelector('img')) {
            return;
          }

          // Skip if element contains order-related content
          const fullText = el.textContent || '';
          if (fullText.includes('Online order #') ||
              fullText.includes('order #') ||
              fullText.includes('Paid') ||
              fullText.includes('Shipped') ||
              fullText.includes('Shipping info') ||
              fullText.includes('View items') ||
              fullText.includes('$')) {
            return;
          }

          const rect = el.getBoundingClientRect();

          // Only process elements that are ABOVE the Orders heading
          if (rect.bottom < ordersRect.top && rect.height > 0 && rect.height < 200) {
            // Check if this element contains account-related text
            const text = fullText.trim();
            if (
              text.includes('Account') ||
              text.includes('@') ||
              text.includes('Membership') ||
              text.includes('GreenHaus Crew') ||
              text.includes('Discounts') ||
              text.includes('Loyalty') ||
              text.includes('Balance:') ||
              text.includes('Communication') ||
              text.includes('Legal') ||
              text.includes('Terms') ||
              text.includes('Sign Out') ||
              text.includes('Home / Store')
            ) {
              el.style.display = 'none';
            }
          }
        });
      }

      // Hide HR elements (divider lines) that are above visible content
      document.querySelectorAll('hr').forEach(hr => {
        hr.style.display = 'none';
      });
    }

    // Run immediately and repeatedly
    hideAccountShowOrders();
    setInterval(hideAccountShowOrders, 300);

    // Watch for DOM changes
    const observer = new MutationObserver(hideAccountShowOrders);
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
  })();
  true;
`;

export default function OrdersTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.orders = ref;
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPasteButton, setShowPasteButton] = useState(false);
  const hasAppliedLinkRef = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Force hide spinner after 8 seconds if WebView is stuck
  useEffect(() => {
    if (isLoading) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('[Orders] Loading timeout - forcing spinner to hide');
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

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data || '{}');

      if (msg.type === 'MAGIC_LINK_REQUESTED') {
        console.log('📧 Magic link requested - showing paste button');
        hasAppliedLinkRef.current = false;
        setTimeout(() => {
          setShowPasteButton(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Orders message error:', error);
    }
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
        source={{ uri: 'https://greenhauscc.com/account/orders' }}
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
});
