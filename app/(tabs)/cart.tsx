import React, { useRef, useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { webviewRefs } from "./_layout";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useFocusEffect } from "expo-router";
import { trackAnalyticsEvent } from "@/services/analytics";
import { shouldTrackStartOrder } from "@/lib/trackingDebounce";
import { useCallback } from "react";

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
    style.textContent = ${JSON.stringify(INJECTED_CSS)};
    document.head.appendChild(style);

    // Hide headers, footers, and breadcrumbs - optimized version
    function hideUIElements() {
      ['header', 'footer', 'nav', '.site-header', '.site-footer', '.ins-header', '.ec-footer', '.breadcrumbs', '.ec-breadcrumbs'].forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          el.style.display = 'none';
        });
      });
    }

    // Run immediately
    hideUIElements();

    // Watch for DOM changes with debouncing for better performance
    let hideTimeout;
    const observer = new MutationObserver(() => {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(hideUIElements, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Auto-expand cart to show quantities on page load
    function expandCart() {
      // Look for the "X items" button/link that expands the cart
      const buttons = document.querySelectorAll('a, button, div[class*="summary"], div[class*="items"]');
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const text = btn.textContent || '';
        if (/\\d+\\s*items?/i.test(text)) {
          // Found the expand button, click it
          btn.click();
          break;
        }
      }
    }

    // Send cart count to React Native
    let hasExpanded = false;
    let lastUrl = '';

    function sendCartCount() {
      let count = 0;
      const bodyText = document.body.innerText || '';
      const currentUrl = window.location.href;

      // ONLY send cart count if we're actually on the cart page
      // Don't send counts from product pages or other pages
      if (!currentUrl.includes('/cart')) {
        return;
      }

      // Reset hasExpanded flag if URL changed (navigated to cart from another page)
      if (currentUrl !== lastUrl) {
        hasExpanded = false;
        lastUrl = currentUrl;
      }

      // Check if cart is empty first
      if (/your (shopping )?cart is empty/i.test(bodyText)) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CART_COUNT_CONFIRMED', count: 0 }));
        return;
      }

      // Method 1: Sum "Qty: X" values (most accurate when visible)
      const qtyMatches = bodyText.match(/Qty:\\s*(\\d+)/gi);
      if (qtyMatches && qtyMatches.length > 0) {
        count = qtyMatches.reduce((sum, match) => {
          const num = parseInt(match.replace(/Qty:\\s*/i, '')) || 0;
          return sum + num;
        }, 0);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CART_COUNT_CONFIRMED', count }));
        return;
      }

      // If no Qty values visible and we haven't tried to expand yet, expand the cart
      if (!hasExpanded) {
        hasExpanded = true;
        expandCart();
        setTimeout(sendCartCount, 300); // Recheck after expanding
        return;
      }

      // Method 2: Try to find Lightspeed header cart badge (hidden but in DOM)
      const header = document.querySelector('header');
      if (header) {
        const cartBadge = header.querySelector('[class*="cart"][class*="count"], [class*="cart"][class*="badge"], [class*="minicart"]');
        if (cartBadge) {
          const badgeText = cartBadge.textContent?.trim();
          if (badgeText && /^\\d+$/.test(badgeText)) {
            count = parseInt(badgeText) || 0;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CART_COUNT_CONFIRMED', count }));
            return;
          }
        }
      }

      // Method 3: Fallback to "X items" text
      const itemsMatch = bodyText.match(/(\\d+)\\s*items?/i);
      if (itemsMatch) {
        count = parseInt(itemsMatch[1]) || 0;
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CART_COUNT_CONFIRMED', count }));
    }

    // Auto-expand on page load first
    setTimeout(expandCart, 500);

    // Wait for expansion before first count check
    setTimeout(sendCartCount, 1000);

    // Then check every 3 seconds (reduced frequency for better performance)
    setInterval(sendCartCount, 3000);

    // Intercept "Continue Shopping", "Browse Store", "Checkout", and "Product" clicks
    let isTracking = false;

    document.addEventListener('click', function(e) {
      let target = e.target;
      if (!target) return;

      // Traverse up to find parent link if clicked on child element (like img)
      let linkElement = target;
      while (linkElement && linkElement.tagName !== 'A' && linkElement !== document.body) {
        linkElement = linkElement.parentElement;
      }

      const text = (target.textContent || '').toLowerCase().trim();
      const href = linkElement && linkElement.tagName === 'A' ? (linkElement.getAttribute('href') || '').toLowerCase() : '';
      const className = (target.className || '').toLowerCase();

      // Check if it's a product link (not checkout or continue shopping)
      if (href && (href.includes('/p/') || (href.includes('greenhauscc.com') && !href.includes('/cart') && !href.includes('checkout')))) {
        e.preventDefault();
        e.stopPropagation();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'NAVIGATE_TO_BROWSE',
          url: linkElement.getAttribute('href')
        }));
        return;
      }

      // Check if it's a checkout button
      if (
        text.includes('checkout') ||
        text.includes('proceed to checkout') ||
        text.includes('go to checkout') ||
        href.includes('checkout') ||
        className.includes('checkout')
      ) {
        if (isTracking) return;

        isTracking = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'START_ORDER' }));
        setTimeout(function() {
          isTracking = false;
        }, 1000);
        return;
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
  const [currentUrl, setCurrentUrl] = useState('https://greenhauscc.com/products/cart');
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
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled={true}
        incognito={false}
        pullToRefreshEnabled={true}
        injectedJavaScript={CART_LISTENER_SCRIPT}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => {
          setIsLoading(false);
          setRefreshing(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
          ref.current?.injectJavaScript(CART_LISTENER_SCRIPT);
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
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'CART_COUNT_CONFIRMED') {
              setCartCount(data.count, true);
            } else if (data.type === 'NAVIGATE_TO_BROWSE') {
              // Switch to browse tab and navigate to URL if provided
              if (data.url && webviewRefs.search?.current) {
                // Navigate browse tab to the product URL
                webviewRefs.search.current.injectJavaScript(`
                  window.location.href = '${data.url}';
                  true;
                `);
              }
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
