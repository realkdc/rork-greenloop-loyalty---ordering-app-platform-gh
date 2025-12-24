import React, { useRef, useState, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from "react-native";
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
  const [hasError, setHasError] = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUrlRef = useRef<string | null>(null);

  // Track the URL we're trying to load for proper retry
  const handleRetry = () => {
    console.log('[Search] Retry requested');
    setHasError(false);
    setIsLoading(true);
    
    // If we have a pending URL (from a product page navigation), reload to that
    if (pendingUrlRef.current && ref.current) {
      console.log('[Search] Reloading to pending URL:', pendingUrlRef.current);
      ref.current.injectJavaScript(`window.location.href = '${pendingUrlRef.current}'; true;`);
    } else {
      ref.current?.reload();
    }
  };

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

  return (
    <View style={styles.container}>
      <WebView
        ref={ref}
        source={{ uri: 'https://greenhauscc.com/products' }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        pullToRefreshEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        cacheEnabled={true}
        incognito={false}
        mixedContentMode="always"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
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
              console.log('[Search] Browser API patch error:', e);
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
        injectedJavaScript={INJECT_SCRIPT}
        onLoadStart={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.log('[Search] Load started:', nativeEvent.url);
          
          // Don't show loading overlay for about:blank or empty urls
          if (nativeEvent.url && nativeEvent.url !== 'about:blank') {
            setIsLoading(true);
            setHasError(false);
          }

          // Track the URL we're loading for retry purposes
          if (nativeEvent.url && nativeEvent.url !== 'about:blank') {
            pendingUrlRef.current = nativeEvent.url;
          }

          // Clear any existing timeout
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
          }

          // Set timeout for 20 seconds (increased from 15) - if page doesn't load, show retry
          loadingTimeoutRef.current = setTimeout(() => {
            console.log('[Search] Load timeout - showing retry button');
            setIsLoading(false);
            setRefreshing(false);
            setHasError(true);
          }, 20000);
        }}
        onLoadEnd={() => {
          console.log('[Search] Load ended');
          
          // Clear timeout since page loaded
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }

          setIsLoading(false);
          setRefreshing(false);
          ref.current?.injectJavaScript(INJECT_SCRIPT);
        }}
        onLoadProgress={({ nativeEvent }) => {
          // If we reach 70% progress, we can probably hide the loading spinner
          // to make it feel faster, but keep the timeout running
          if (nativeEvent.progress > 0.7) {
            setIsLoading(false);
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[Search] WebView error:', nativeEvent);
          setIsLoading(false);
          setRefreshing(false);
          // Only show error for real failures, not just canceled requests
          if (nativeEvent.description !== 'net::ERR_ABORTED') {
            setHasError(true);
          }
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[Search] HTTP error:', nativeEvent.statusCode, nativeEvent.url);
          setIsLoading(false);
          setRefreshing(false);
          setHasError(true);
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
          <Text style={styles.errorText}>Failed to load page</Text>
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
    backgroundColor: "#FFFFFF",
  },
  webview: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
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
