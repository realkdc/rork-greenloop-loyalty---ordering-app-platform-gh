import React, { useRef, useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
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
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Force hide spinner after 8 seconds if WebView is stuck
  useEffect(() => {
    if (isLoading) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('[Cart] Loading timeout - forcing spinner to hide');
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

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5DB075" />
        </View>
      )}
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
        injectedJavaScript={CART_LISTENER_SCRIPT}
        onLoadStart={() => {
          console.log('[Cart] Load started');
          setIsLoading(true);
        }}
        onLoadEnd={() => {
          console.log('[Cart] Load ended');
          setIsLoading(false);
          setRefreshing(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
          // Re-inject on every load to ensure it's running
          ref.current?.injectJavaScript(CART_LISTENER_SCRIPT);
        }}
        onError={(error) => {
          console.error('[Cart] WebView error:', error.nativeEvent);
          setIsLoading(false);
          setRefreshing(false);
        }}
        onHttpError={(error) => {
          console.error('[Cart] HTTP error:', error.nativeEvent);
          setIsLoading(false);
          setRefreshing(false);
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
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#5DB075" />
          </View>
        )}
        startInLoadingState={false}
      />
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
});
