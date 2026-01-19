import React, { useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { webviewRefs } from "./_layout";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { trackAnalyticsEvent } from "@/services/analytics";
import { shouldTrackStartOrder } from "@/lib/trackingDebounce";

const INJECTED_CSS = `
  /* Hide header, footer, and breadcrumbs only */
  header, .ins-header, .site-header,
  footer, .site-footer, .ec-footer,
  nav, .navigation, .site-nav,
  .breadcrumbs, .ec-breadcrumbs {
    display: none !important;
  }

  body {
    padding-top: 20px !important;
  }

  /* Hide SORT BY dropdown */
  button:has-text("SORT BY"),
  div:has(> button:contains("SORT BY")),
  [class*="sort"],
  [class*="Sort"],
  .ec-sorting,
  .product-sorting,
  .catalog-sorting {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    overflow: hidden !important;
  }

  /* Hide vape categories and products */
  a[href*="/disposables"],
  a[href*="/Disposables"],
  a[href*="/cartridges"],
  a[href*="/Cartridges"],
  a[href*="disposable"],
  a[href*="Disposable"],
  a[href*="cartridge"],
  a[href*="Cartridge"],
  a[href*="veil"],
  a[href*="Veil"],
  a[href*="VEIL"],
  a[href*="bar-pro"],
  a[href*="Bar-Pro"],
  a[aria-label*="Disposable"],
  a[aria-label*="Cartridge"],
  a[aria-label*="Veil"],
  div:has(> a[href*="disposable"]),
  div:has(> a[href*="Disposable"]),
  div:has(> a[href*="cartridge"]),
  div:has(> a[href*="Cartridge"]),
  div:has(> a[href*="veil"]),
  div:has(> a[href*="Veil"]),
  .ec-grid__category-item:has(a[href*="disposable"]),
  .ec-grid__category-item:has(a[href*="Disposable"]),
  .ec-grid__category-item:has(a[href*="cartridge"]),
  .ec-grid__category-item:has(a[href*="Cartridge"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    height: 0 !important;
    width: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
  }
`;

const INJECT_SCRIPT = `
  (function() {
    const style = document.createElement('style');
    style.textContent = ${JSON.stringify(INJECTED_CSS)};
    document.head.appendChild(style);

    // Hide header, footer, nav only
    function hideUIElements() {
      ['header', 'footer', 'nav', '.breadcrumbs'].forEach(selector => {
        document.querySelectorAll(selector).forEach(el => el.style.display = 'none');
      });

      // Hide SORT BY dropdown - very aggressive
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.trim();
        // Check if element or any child contains SORT BY
        if (text === 'SORT BY' || (text && text.includes('SORT BY') && text.length < 50)) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.height = '0';
          el.style.overflow = 'hidden';
          // Also hide parent containers
          if (el.parentElement) {
            const parentText = el.parentElement.textContent?.trim();
            if (parentText && parentText.includes('SORT BY') && parentText.length < 100) {
              el.parentElement.style.display = 'none';
            }
          }
        }
        // Also check by class name
        const className = el.className || '';
        if (typeof className === 'string' && (className.includes('sort') || className.includes('Sort'))) {
          el.style.display = 'none';
        }
      });
    }

    // Run on page load
    hideUIElements();
    setInterval(hideUIElements, 1000);

    // Browse tab no longer sends cart counts
    // Only Cart tab should report cart counts for accuracy

    // Debounce add to cart tracking
    window.__ghLastAddToCart = window.__ghLastAddToCart || 0;

    // Track Add to Cart button clicks
    document.addEventListener('click', function(e) {
      let target = e.target;
      if (!target) return;

      // Check element and parents for add to cart button
      let el = target;
      let depth = 0;
      while (el && depth < 5) {
        const text = (el.textContent || '').toLowerCase().trim();
        const className = (el.className || '').toString().toLowerCase();

        if (
          text === 'add to bag' ||
          text === 'add to cart' ||
          text.includes('add to bag') ||
          text.includes('add to cart') ||
          className.includes('add-to-cart') ||
          className.includes('addtocart') ||
          className.includes('ec-product__add-to-cart')
        ) {
          // Debounce: only fire once every 2 seconds
          var now = Date.now();
          if (now - window.__ghLastAddToCart < 2000) {
            console.log('[Browse] Add to cart debounced');
            return;
          }
          window.__ghLastAddToCart = now;

          console.log('[Browse] Add to cart clicked');
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ADD_TO_CART' }));
          return;
        }
        el = el.parentElement;
        depth++;
      }
    }, true);
  })();
  true;
`;

export default function SearchTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.search = ref;
  const router = useRouter();
  const { setCartCount } = useApp();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url || '';
    console.log('[Search] Navigation state changed:', {
      url,
      loading: navState.loading,
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
    });

    // Track product views (URLs with /p/ are product pages)
    if (url.includes('/p/') && !navState.loading) {
      // Extract product name from URL (e.g., /p/product-name-123)
      const productMatch = url.match(/\/p\/([^/?]+)/);
      const productSlug = productMatch ? productMatch[1] : 'unknown';
      console.log('[Search] Product view detected:', productSlug);
      trackAnalyticsEvent('PRODUCT_VIEW', { product: productSlug, url }, user?.uid);
    }

    // If navigated to cart page, switch to cart tab and reload it
    if (url.includes('/cart') || url.includes('/products/cart')) {
      console.log('[Search] Detected cart navigation - switching to cart tab');
      // Reload cart tab to show updated items
      const cartRef = webviewRefs.cart?.current;
      if (cartRef) {
        cartRef.reload();
      }
      router.push('/(tabs)/cart');
    }
  };

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5DB075" />
        </View>
      )}
      <WebView
        ref={ref}
        source={{ uri: 'https://greenhauscc.com/products' }}
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
        allowsBackForwardNavigationGestures={true}
        injectedJavaScript={INJECT_SCRIPT}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => {
          setIsLoading(false);
          setRefreshing(false);
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
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            // Browse tab no longer handles CART_COUNT messages
            // Only Cart tab updates cart count
            if (data.type === 'START_ORDER') {
              if (shouldTrackStartOrder()) {
                trackAnalyticsEvent('CHECKOUT_START', {}, user?.uid);
              }
            } else if (data.type === 'ADD_TO_CART') {
              console.log('[Browse] Tracking ADD_TO_CART event');
              trackAnalyticsEvent('ADD_TO_CART', {}, user?.uid);
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
