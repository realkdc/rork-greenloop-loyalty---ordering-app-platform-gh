import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform, Linking, ToastAndroid, Alert } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { webviewRefs } from "./_layout";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { trackAnalyticsEvent } from "@/services/analytics";
import { shouldTrackStartOrder } from "@/lib/trackingDebounce";
import { getPlatformConfig } from "@/constants/config";

const INJECTED_CSS = `
  /* Hide header, footer, and breadcrumbs */
  header, .ins-header, .site-header,
  footer, .site-footer, .ec-footer,
  nav, .navigation, .site-nav,
  .breadcrumbs, .ec-breadcrumbs {
    display: none !important;
  }

  /* Hide sort by dropdown */
  .ec-filters__sortby,
  .grid__sort,
  .sort-by-button {
    display: none !important;
  }

  body {
    padding-top: 20px !important;
  }

  /* Hide Disposables & Cartridges category by ID */
  .grid-category--id-180876996,
  .grid-category--id-186220324,
  .grid-category--id-186221826 {
    display: none !important;
  }

  /* Hide vape categories and products by URL/text patterns */
  .grid-category:has(a[href*="Disposables"]),
  .grid-category:has(a[href*="Cartridges"]),
  .grid-category:has(a[href*="disposable"]),
  .grid-category:has(a[href*="cartridge"]),
  .grid-category:has(a[title*="Disposable"]),
  .grid-category:has(a[title*="Cartridge"]),
  a[href*="Disposables-"],
  a[href*="Cartridges-"],
  a[href*="-c180876996"],
  a[href*="-c186220324"],
  a[href*="-c186221826"],
  a[href*="veil"],
  a[href*="Veil"],
  a[href*="bar-pro"] {
    display: none !important;
  }
`;

const INJECT_SCRIPT = `
  (function() {
    // Inject CSS
    var style = document.createElement('style');
    style.textContent = \`${INJECTED_CSS}\`;
    document.head.appendChild(style);

    // Check if element is a purchase BUTTON (not product cards)
    function isPurchaseElement(el) {
      if (!el) return false;
      
      var clickedTag = (el.tagName || '').toLowerCase();
      var clickedCls = (el.className || '').toLowerCase();
      
      // SKIP if clicking on a product card/link (not a button)
      // Product cards have grid-product class or are links to product pages
      var parent = el;
      for (var p = 0; p < 5 && parent; p++) {
        var pCls = (parent.className || '').toLowerCase();
        var pHref = (parent.getAttribute ? parent.getAttribute('href') : '') || '';
        // If we're in a product card/grid, don't intercept unless it's actually a button
        if (pCls.indexOf('grid-product') !== -1 || pCls.indexOf('product-card') !== -1) {
          // Only intercept if the clicked element is a button
          if (clickedTag !== 'button' && clickedCls.indexOf('button') === -1) {
            return false;
          }
        }
        parent = parent.parentElement;
      }
      
      // Only check clicked element and 2 immediate parents (not whole card)
      for (var i = 0; i < 3 && el; i++) {
        var text = (el.innerText || el.textContent || '').toLowerCase().trim();
        var cls = (el.className || '').toLowerCase();
        var href = (el.getAttribute ? el.getAttribute('href') : '') || '';
        var tag = (el.tagName || '').toLowerCase();
        
        // Only match actual buttons or button-like elements
        var isButton = tag === 'button' || cls.indexOf('button') !== -1 || cls.indexOf('btn') !== -1;
        
        // Match by text content ONLY if it's a button element
        if (isButton || i === 0) {
          if (
            text === 'add to bag' ||
            text === 'add to cart' ||
            text === 'add more' ||
            text === 'go to checkout' ||
            text === 'checkout' ||
            text === 'view cart' ||
            text === 'proceed to checkout'
          ) {
            return true;
          }
        }
        
        // Match by Ecwid button class names
        if (
          cls.indexOf('form-control__button') !== -1 ||
          cls.indexOf('add-to-cart') !== -1 ||
          cls.indexOf('add-to-bag') !== -1 ||
          cls.indexOf('details-product-purchase__add-to-bag') !== -1
        ) {
          return true;
        }
        
        el = el.parentElement;
      }
      return false;
    }

    // Intercept purchase button clicks
    var clicking = false;
    document.addEventListener('click', function(e) {
      if (clicking) return;
      
      var target = e.target;
      if (!target) return;
      
      if (isPurchaseElement(target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        clicking = true;
        
        // Get product URL from current page
        var url = window.location.href;
        var productId = null;
        var m = url.match(/product\\/id=(\\d+)/i) || url.match(/-p(\\d+)$/i) || url.match(/product\\/(\\d+)/i);
        if (m) productId = m[1];
        
        var productUrl = productId ? 
          'https://greenhauscc.com/products#!/~/product/id=' + productId : 
          url.indexOf('greenhauscc.com') !== -1 ? url : 'https://greenhauscc.com/products';
        
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'OPEN_EXTERNAL_CHECKOUT',
          url: productUrl,
          productId: productId
        }));
        
        setTimeout(function() { clicking = false; }, 2000);
        return false;
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
  const [showRetry, setShowRetry] = useState(false);
  const [currentWebViewUrl, setCurrentWebViewUrl] = useState('https://greenhauscc.com/products');
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Force hide spinner after 10 seconds if WebView is stuck
  // Only show retry after very long load (30 seconds)
  useEffect(() => {
    if (isLoading) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setShowRetry(true);
      }, 30000);
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

  // Open URL in external browser
  const openInExternalBrowser = useCallback(async (url: string) => {
    
    try {
      // Use Chrome Custom Tabs for better UX
      const result = await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: '#1E4D3A',
        controlsColor: '#FFFFFF',
        showTitle: true,
      });
    } catch (error) {
      try {
        await Linking.openURL(url);
      } catch (linkError) {
        Alert.alert(
          'Unable to Open Browser',
          'Please visit greenhauscc.com in your browser to complete your purchase.',
          [{ text: 'OK' }]
        );
      }
    }
  }, []);

  // Pull to refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    ref.current?.reload();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Check if URL is a cart/checkout route
  const isCartOrCheckoutRoute = useCallback((url: string) => {
    const normalizedUrl = url.toLowerCase();
    return (
      normalizedUrl.includes('/cart') ||
      normalizedUrl.includes('/checkout') ||
      normalizedUrl.includes('#cart') ||
      normalizedUrl.includes('#checkout') ||
      normalizedUrl.includes('#!/cart') ||
      normalizedUrl.includes('#!/checkout') ||
      normalizedUrl.includes('/products/cart')
    );
  }, []);

  // Intercept navigation before it happens
  const handleShouldStartLoadWithRequest = useCallback((request: WebViewNavigation) => {
    const url = request.url || '';
    const platformConfig = getPlatformConfig();
    
    if (Platform.OS === 'android' && !platformConfig.allowPurchaseFlow && isCartOrCheckoutRoute(url)) {
      
      // Use the last non-cart URL (the product page they were on)
      const urlToOpen = currentWebViewUrl || 'https://greenhauscc.com/products';
      
      if (Platform.OS === 'android') {
        ToastAndroid.show('Opening product in browser - please add to cart there to checkout', ToastAndroid.LONG);
      }
      openInExternalBrowser(urlToOpen);
      
      return false;
    }
    
    return true;
  }, [isCartOrCheckoutRoute, openInExternalBrowser, currentWebViewUrl]);

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url || '';
    const platformConfig = getPlatformConfig();

    // Track current URL for use when opening external browser
    if (url && !isCartOrCheckoutRoute(url)) {
      setCurrentWebViewUrl(url);
    }

    // If navigated to cart page
    if (isCartOrCheckoutRoute(url)) {
      
      // On Android where purchase flow is disabled, open the current page in browser
      if (Platform.OS === 'android' && !platformConfig.allowPurchaseFlow) {
        // Use the last non-cart URL (the product page they were on)
        const urlToOpen = currentWebViewUrl || 'https://greenhauscc.com/products';
        
        if (Platform.OS === 'android') {
          ToastAndroid.show('Opening product in browser - please add to cart there to checkout', ToastAndroid.LONG);
        }
        openInExternalBrowser(urlToOpen);
        ref.current?.goBack();
        return;
      }
      
      // iOS: allow normal cart flow if cart tab exists
      if (platformConfig.allowPurchaseFlow) {
        const cartRef = webviewRefs.cart?.current;
        if (cartRef) {
          cartRef.reload();
        }
        router.push('/(tabs)/cart');
      }
    }
  };

  const handleRetry = () => {
    setShowRetry(false);
    setIsLoading(true);
    ref.current?.reload();
  };

  return (
    <View style={styles.container}>
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
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        androidLayerType="hardware"
        sharedCookiesEnabled={true}
        injectedJavaScriptBeforeContentLoaded={`
          var style = document.createElement('style');
          style.textContent = \`${INJECTED_CSS}\`;
          (document.head || document.documentElement).appendChild(style);
          true;
        `}
        injectedJavaScript={INJECT_SCRIPT}
        onLoadStart={() => {
          setIsLoading(true);
          setShowRetry(false);
        }}
        onLoadEnd={() => {
          setIsLoading(false);
          setRefreshing(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
        }}
        onLoadProgress={({ nativeEvent }) => {
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
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'CART_COUNT') {
              setCartCount(data.count);
            } else if (data.type === 'OPEN_EXTERNAL_CHECKOUT') {
              
              const url = data.url || 'https://greenhauscc.com/products';
              const productName = data.productName;
              
              
              // Show helpful message telling user to re-add to cart
              if (Platform.OS === 'android') {
                if (productName) {
                  ToastAndroid.show(`Opening "${productName}" - please add to cart in browser to checkout`, ToastAndroid.LONG);
                } else {
                  ToastAndroid.show('Opening store - please add items to cart in browser to checkout', ToastAndroid.LONG);
                }
              }
              
              openInExternalBrowser(url);
            } else if (data.type === 'START_ORDER') {
              if (shouldTrackStartOrder()) {
                trackAnalyticsEvent('START_ORDER_CLICK', {}, user?.uid);
              }
            }
          } catch (e) {
          }
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
  loadingBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
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
