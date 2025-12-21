import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform, Linking, ToastAndroid, Alert } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import CookieManager from "@react-native-cookies/cookies";
import { webviewRefs } from "./_layout";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { trackAnalyticsEvent } from "@/services/analytics";
import { shouldTrackStartOrder } from "@/lib/trackingDebounce";
import { getPlatformConfig } from "@/constants/config";

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

    // Check if element matches CHECKOUT patterns (NOT add to cart!)
    function isCheckoutElement(element) {
      if (!element) return false;
      
      // Get the DIRECT text of the clicked element
      const directText = (element.innerText || element.textContent || '').toLowerCase().trim();
      
      // EXCLUDE: Add to bag/cart buttons - these should work normally
      if (
        directText.includes('add to bag') ||
        directText.includes('add to cart') ||
        directText.includes('add item') ||
        directText === 'add' ||
        directText.includes('buy now')
      ) {
        console.log('[Browse JS] ✅ Add to cart button - allowing normal behavior');
        return false;
      }
      
      // Check this element and up to 3 parent levels
      let el = element;
      for (let i = 0; i < 3 && el; i++) {
        const text = (el.innerText || el.textContent || '').toLowerCase().trim();
        const href = (el.getAttribute && el.getAttribute('href') || '').toLowerCase();
        const className = (el.className || '').toLowerCase();
        
        // EXCLUDE add to cart buttons at any level
        if (
          text.includes('add to bag') ||
          text.includes('add to cart') ||
          className.includes('add-to-cart') ||
          className.includes('add-to-bag') ||
          className.includes('ec-product-browser__button')
        ) {
          console.log('[Browse JS] ✅ Add to cart element - allowing normal behavior');
          return false;
        }
        
        // ONLY match explicit checkout/view cart actions
        if (
          text === 'go to checkout' ||
          text === 'proceed to checkout' ||
          text === 'checkout' ||
          text === 'view cart' ||
          text === 'view shopping cart' ||
          text === 'shopping cart' ||
          (href.includes('/cart') && !href.includes('add')) ||
          (href.includes('#cart') || href.includes('#!/cart')) ||
          (href.includes('checkout') && !href.includes('add'))
        ) {
          console.log('[Browse JS] 🛒 Checkout/view cart button detected:', text);
          return true;
        }
        
        el = el.parentElement;
      }
      return false;
    }

    // Intercept checkout/cart button clicks
    let isTracking = false;
    document.addEventListener('click', function(e) {
      if (isTracking) return;

      const target = e.target;
      if (!target) return;

      if (isCheckoutElement(target)) {
        console.log('[Browse JS] 🛒 Checkout/cart button clicked - intercepting!');
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        isTracking = true;
        
        // Get cart count for info
        const cartBadge = document.querySelector('.ec-cart-widget__count, .ec-minicart__count');
        const cartCount = cartBadge ? parseInt(cartBadge.textContent || '0') : 0;
        
        // Open the CART page in browser - cookies will be synced so cart should be there
        const cartUrl = 'https://greenhauscc.com/products#!/~/cart';
        console.log('[Browse JS] Opening cart URL with synced cookies:', cartUrl, 'Cart count:', cartCount);
        
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'OPEN_EXTERNAL_CHECKOUT',
          url: cartUrl,
          cartCount: cartCount
        }));

        setTimeout(function() {
          isTracking = false;
        }, 2000);
        
        return false;
      }
    }, true);

    // Intercept hash changes ONLY for full cart page navigation
    let lastHash = window.location.hash;
    let hashChangeBlocked = false;
    
    function checkHashChange() {
      if (hashChangeBlocked) return;
      
      const currentHash = window.location.hash.toLowerCase();
      if (currentHash !== lastHash) {
        const oldHash = lastHash;
        lastHash = currentHash;
        
        // Only trigger for EXPLICIT cart PAGE navigation
        const isCartPageHash = (
          currentHash === '#!/~/cart' ||
          currentHash === '#/~/cart' ||
          currentHash === '#!/cart' ||
          currentHash.startsWith('#!/~/cart/') ||
          currentHash.startsWith('#/~/cart/') ||
          currentHash === '#!/~/checkout' ||
          currentHash.startsWith('#!/~/checkout/')
        );
        
        // Skip if coming from a product page
        const wasOnProduct = oldHash.includes('/product/') || oldHash.includes('#!/~/product');
        
        if (isCartPageHash && !wasOnProduct) {
          console.log('[Browse JS] 🛒 Cart PAGE navigation detected:', currentHash);
          
          hashChangeBlocked = true;
          setTimeout(() => { hashChangeBlocked = false; }, 3000);
          
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'OPEN_EXTERNAL_CHECKOUT',
            url: 'https://greenhauscc.com/products/cart'
          }));
          
          try { history.back(); } catch(e) {}
        }
      }
    }
    
    window.addEventListener('hashchange', checkHashChange);

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

  // Sync WebView cookies to native cookie store before opening browser
  const syncCookiesToBrowser = useCallback(async () => {
    try {
      console.log('[Browse] 🍪 Syncing cookies from WebView to browser...');
      
      // Get all cookies from the WebView for greenhauscc.com
      const cookies = await CookieManager.get('https://greenhauscc.com');
      console.log('[Browse] 🍪 Found cookies:', Object.keys(cookies));
      
      // Also get cookies from ecwid.com
      const ecwidCookies = await CookieManager.get('https://app.ecwid.com');
      console.log('[Browse] 🍪 Found Ecwid cookies:', Object.keys(ecwidCookies));
      
      // Flush cookies to ensure they're synced to the native store
      await CookieManager.flush();
      console.log('[Browse] 🍪 Cookies flushed to native store');
      
      return true;
    } catch (error) {
      console.log('[Browse] 🍪 Cookie sync error:', error);
      return false;
    }
  }, []);

  // Open URL in external browser using Chrome Custom Tabs with cookie sync
  const openInExternalBrowser = useCallback(async (url: string, cartCount: number = 0) => {
    console.log('[Browse] Opening external browser:', url);
    
    if (Platform.OS === 'android') {
      ToastAndroid.show('Syncing cart to browser...', ToastAndroid.SHORT);
    }
    
    // IMPORTANT: Sync cookies from WebView to native store FIRST
    await syncCookiesToBrowser();
    
    try {
      // Use Chrome Custom Tabs - they share cookies with Chrome browser
      const result = await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: '#1E4D3A',
        controlsColor: '#FFFFFF',
        showTitle: true,
      });
      console.log('[Browse] ✅ WebBrowser result:', result.type);
    } catch (error) {
      console.log('[Browse] WebBrowser failed, trying Linking:', error);
      try {
        await Linking.openURL(url);
        console.log('[Browse] ✅ Opened via Linking');
      } catch (linkError) {
        console.log('[Browse] ❌ Both methods failed:', linkError);
        Alert.alert(
          'Unable to Open Browser',
          'Please visit greenhauscc.com in your browser to complete your purchase.',
          [{ text: 'OK' }]
        );
      }
    }
  }, [syncCookiesToBrowser]);

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
      console.log('[Browse] 🚫 Intercepting cart/checkout navigation:', url);
      openInExternalBrowser('https://greenhauscc.com/products/cart');
      return false;
    }
    
    return true;
  }, [isCartOrCheckoutRoute, openInExternalBrowser]);

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url || '';
    const platformConfig = getPlatformConfig();

    // If navigated to cart page
    if (isCartOrCheckoutRoute(url)) {
      console.log('[Browse] Cart/checkout detected in navigation state:', url);
      
      // On Android where purchase flow is disabled, open external browser
      if (Platform.OS === 'android' && !platformConfig.allowPurchaseFlow) {
        console.log('[Browse] Opening external browser and going back...');
        openInExternalBrowser('https://greenhauscc.com/products/cart');
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
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
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
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'CART_COUNT') {
              setCartCount(data.count);
            } else if (data.type === 'OPEN_EXTERNAL_CHECKOUT') {
              console.log('[Browse] 📱 Received OPEN_EXTERNAL_CHECKOUT message:', data);
              
              // Use cart URL - cookies will be synced
              const url = data.url || 'https://greenhauscc.com/products#!/~/cart';
              const cartCount = data.cartCount || 0;
              
              console.log('[Browse] Opening cart in browser with cookie sync. Cart items:', cartCount);
              
              if (Platform.OS === 'android' && cartCount > 0) {
                ToastAndroid.show(`Syncing ${cartCount} cart items to browser...`, ToastAndroid.SHORT);
              }
              
              openInExternalBrowser(url, cartCount);
            } else if (data.type === 'START_ORDER') {
              if (shouldTrackStartOrder()) {
                trackAnalyticsEvent('START_ORDER_CLICK', {}, user?.uid);
              }
            }
          } catch (e) {
            console.log('[Browse] Error parsing message:', e);
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
