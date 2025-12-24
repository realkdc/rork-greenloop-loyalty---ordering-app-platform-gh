import React, { useRef, useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { WebView } from "react-native-webview";
import { webviewRefs } from "./_layout";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { trackAnalyticsEvent } from "@/services/analytics";
import { shouldTrackStartOrder } from "@/lib/trackingDebounce";

const INJECTED_CSS = `
  /* Hide header, footer, and breadcrumbs */
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

const CART_LISTENER_SCRIPT = `
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

    // Send cart count to React Native
    function sendCartCount() {
      let count = 0;

      // Method 1: Try cart badge selectors (works even when hidden with CSS)
      const badge = document.querySelector('.ec-cart-widget__count, .ec-minicart__count, .cart-count, [data-cart-count]');
      if (badge && badge.textContent) {
        const badgeCount = parseInt(badge.textContent.trim()) || 0;
        if (badgeCount > 0) {
          count = badgeCount;
        }
      }

      // Method 2: Look for "X items" text (cart page, checkout page)
      if (count === 0) {
        const itemsTextElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          return /\\d+\\s*items?/i.test(text) && el.children.length === 0;
        });

        if (itemsTextElements.length > 0) {
          const match = itemsTextElements[0].textContent.match(/(\\d+)\\s*items?/i);
          if (match) {
            count = parseInt(match[1]) || 0;
          }
        }
      }

      // Method 3: Count cart item rows directly
      if (count === 0) {
        const cartItems = document.querySelectorAll('.ec-cart-item, .cart-item, .ec-cart__product, [data-product-id]');
        if (cartItems.length > 0) {
          count = cartItems.length;
        }
      }

      // Use CART_COUNT_CONFIRMED for cart page to force-clear when cart is actually empty
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CART_COUNT_CONFIRMED', count }));
    }

    // Check every 2 seconds
    setInterval(sendCartCount, 2000);
    sendCartCount(); // Send immediately

    // Intercept "Continue Shopping", "Browse Store", and "Checkout" button clicks
    let isTracking = false;

    document.addEventListener('click', function(e) {
      const target = e.target;
      if (!target) return;

      const text = (target.textContent || '').toLowerCase().trim();
      const href = (target.getAttribute('href') || '').toLowerCase();
      const className = (target.className || '').toLowerCase();

      // Check if it's a checkout button
      if (
        text.includes('checkout') ||
        text.includes('proceed to checkout') ||
        text.includes('go to checkout') ||
        href.includes('checkout') ||
        className.includes('checkout')
      ) {
        if (isTracking) return;

        console.log('[Cart] Checkout button clicked');
        isTracking = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'START_ORDER' }));
        setTimeout(function() {
          isTracking = false;
        }, 1000);
      }

      // Check if it's a continue shopping or browse store button
      if (
        text.includes('continue shopping') ||
        text.includes('browse store') ||
        text.includes('shop now') ||
        href.includes('/products') ||
        className.includes('continue') ||
        className.includes('browse')
      ) {
        console.log('[Cart] Continue/Browse button clicked - switching to browse tab');
        e.preventDefault();
        e.stopPropagation();
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NAVIGATE_TO_BROWSE' }));
      }
    }, true);
  })();
  true;
`;

export default function CartTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.cart = ref;
  const { setCartCount } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUrlRef = useRef<string | null>(null);

  const handleRetry = () => {
    console.log('[Cart] Retry requested');
    setHasError(false);
    setIsLoading(true);
    
    // If we have a pending URL (from a navigation), reload to that
    if (pendingUrlRef.current && ref.current) {
      console.log('[Cart] Reloading to pending URL:', pendingUrlRef.current);
      ref.current.injectJavaScript(`window.location.href = '${pendingUrlRef.current}'; true;`);
    } else {
      ref.current?.reload();
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={ref}
        source={{ uri: 'https://greenhauscc.com/products/cart' }}
        style={styles.webview}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        javaScriptEnabled
        domStorageEnabled
        pullToRefreshEnabled={true}
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        injectedJavaScriptBeforeContentLoaded={`
          // Patch navigator properties for Cloudflare
          (function() {
            try {
              Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
                configurable: true
              });

              if (!navigator.platform) {
                Object.defineProperty(navigator, 'platform', {
                  get: () => 'Linux armv8l',
                  configurable: true
                });
              }

              if (!navigator.hardwareConcurrency) {
                Object.defineProperty(navigator, 'hardwareConcurrency', {
                  get: () => 8,
                  configurable: true
                });
              }

              if (!navigator.deviceMemory) {
                Object.defineProperty(navigator, 'deviceMemory', {
                  get: () => 8,
                  configurable: true
                });
              }
            } catch (e) {
              console.log('[Cart] Browser API patch error:', e);
            }

            // IMMEDIATELY inject CSS to prevent header/footer flash
            try {
              const style = document.createElement('style');
              style.textContent = \`
                header, footer, nav, 
                .ins-header, .site-header, .site-footer, .ec-footer, 
                .breadcrumbs, .ec-breadcrumbs,
                .navigation, .site-nav,
                #header, #footer {
                  display: none !important;
                  opacity: 0 !important;
                  visibility: hidden !important;
                  height: 0 !important;
                  pointer-events: none !important;
                }
                body { padding-top: 20px !important; }
              \`;
              document.documentElement.appendChild(style);
              
              // Briefly hide body to prevent content flash during initial render
              const hideBody = document.createElement('style');
              hideBody.textContent = 'body { opacity: 0 !important; transition: opacity 0.2s ease; }';
              document.documentElement.appendChild(hideBody);
              
              // Show body after 250ms
              setTimeout(() => {
                hideBody.textContent = 'body { opacity: 1 !important; }';
                setTimeout(() => hideBody.remove(), 200);
              }, 250);

              // Also hide specifically targeted elements as they appear
              const observer = new MutationObserver(() => {
                const targets = document.querySelectorAll('header, footer, nav, .ins-header, .site-header, .site-footer, .ec-footer, .breadcrumbs, .ec-breadcrumbs, #header, #footer');
                targets.forEach(el => {
                  if (el.style.display !== 'none') {
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('opacity', '0', 'important');
                  }
                });
              });
              observer.observe(document.documentElement, { childList: true, subtree: true });
            } catch (e) {}
          })();
          true;
        `}
        injectedJavaScript={CART_LISTENER_SCRIPT}
        onLoadStart={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.log('[Cart] Load started:', nativeEvent.url);
          
          if (nativeEvent.url && nativeEvent.url !== 'about:blank') {
            setIsLoading(true);
            setHasError(false);
            pendingUrlRef.current = nativeEvent.url;
          }

          // Clear any existing timeout
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
          }

          // Set timeout for 20 seconds
          loadingTimeoutRef.current = setTimeout(() => {
            console.log('[Cart] Load timeout - showing retry button');
            setIsLoading(false);
            setRefreshing(false);
            setHasError(true);
          }, 20000);
        }}
        onLoadEnd={() => {
          console.log('[Cart] Load ended');
          
          // Clear timeout since page loaded
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }

          setIsLoading(false);
          setRefreshing(false);
          // Re-inject on every load to ensure it's running
          ref.current?.injectJavaScript(CART_LISTENER_SCRIPT);
        }}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress > 0.7) {
            setIsLoading(false);
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[Cart] WebView error:', nativeEvent);
          setIsLoading(false);
          setRefreshing(false);
          if (nativeEvent.description !== 'net::ERR_ABORTED') {
            setHasError(true);
          }
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[Cart] HTTP error:', nativeEvent.statusCode, nativeEvent.url);
          setIsLoading(false);
          setRefreshing(false);
          setHasError(true);
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'CART_COUNT_CONFIRMED') {
              // Cart tab sends confirmed count - always trust it, even if 0
              setCartCount(data.count, true);
            } else if (data.type === 'NAVIGATE_TO_BROWSE') {
              // Switch to browse tab
              router.push('/(tabs)/search');
            } else if (data.type === 'START_ORDER') {
              // Track checkout button click
              if (shouldTrackStartOrder()) {
                trackAnalyticsEvent('START_ORDER_CLICK', {}, user?.uid);
              }
            }
          } catch (e) {}
        }}
        renderLoading={() => <View />}
        startInLoadingState={false}
      />

      {isLoading && !hasError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5DB075" />
        </View>
      )}

      {hasError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load cart</Text>
          <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Tap to Retry</Text>
          </TouchableOpacity>
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
  errorContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#5DB075',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
