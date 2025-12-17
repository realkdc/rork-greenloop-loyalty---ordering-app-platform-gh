import React, { useRef, useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform } from "react-native";
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
    style.textContent = \`${INJECTED_CSS}\`;
    document.head.appendChild(style);

    // Send cart count to React Native
    function sendCartCount() {
      let count = 0;
      const badge = document.querySelector('.ec-cart-widget__count, .ec-minicart__count, .cart-count, [data-cart-count]');
      if (badge && badge.textContent) {
        count = parseInt(badge.textContent.trim()) || 0;
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CART_COUNT', count }));
    }

    // Send immediately and every 3 seconds
    sendCartCount();
    setInterval(sendCartCount, 3000);
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
  const [showRetry, setShowRetry] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Force hide spinner after 10 seconds if WebView is stuck
  useEffect(() => {
    if (isLoading) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('[Browse] Loading timeout - showing retry button');
        setIsLoading(false);
        setRefreshing(false);
        setShowRetry(true);
      }, 10000);
    } else {
      setShowRetry(false);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [isLoading]);

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url || '';
    console.log('[Search] Navigation state changed:', {
      url,
      loading: navState.loading,
      canGoBack: navState.canGoBack,
      canGoForward: navState.canGoForward,
    });

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

  const handleRetry = () => {
    console.log('[Browse] Retry button pressed - reloading WebView');
    setShowRetry(false);
    setIsLoading(true);
    ref.current?.reload();
  };

  return (
    <View style={styles.container}>
      {isLoading && !showRetry && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5DB075" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      )}
      {showRetry && (
        <View style={styles.retryOverlay}>
          <Text style={styles.retryTitle}>Page Taking Too Long</Text>
          <Text style={styles.retryText}>
            The page is taking longer than expected to load.{'\n'}
            Check your connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
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
        pullToRefreshEnabled={true}
        androidHardwareAccelerationDisabled={false}
        androidLayerType="hardware"
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        injectedJavaScript={INJECT_SCRIPT}
        onLoadStart={() => {
          console.log('[Search] Load started');
          setIsLoading(true);
          setShowRetry(false);
        }}
        onLoadEnd={() => {
          console.log('[Search] Load ended');
          setIsLoading(false);
          setRefreshing(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
          ref.current?.injectJavaScript(INJECT_SCRIPT);
        }}
        onLoadProgress={({ nativeEvent }) => {
          console.log('[Search] Load progress:', nativeEvent.progress);
          // If we're making progress, extend the timeout
          if (nativeEvent.progress > 0.1) {
            setShowRetry(false);
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[Search] WebView error:', nativeEvent);
          setIsLoading(false);
          setRefreshing(false);
          setShowRetry(true);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[Search] HTTP error:', nativeEvent.statusCode, nativeEvent.url);
          setIsLoading(false);
          setRefreshing(false);
        }}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'CART_COUNT') {
              setCartCount(data.count);
            } else if (data.type === 'START_ORDER') {
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  retryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 1000,
  },
  retryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E4D3A',
    marginBottom: 12,
  },
  retryText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#1E4D3A',
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
