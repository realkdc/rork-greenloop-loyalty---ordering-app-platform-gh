import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, ActivityIndicator, Platform, Linking, ToastAndroid, Alert } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import CookieManager from "@react-native-cookies/cookies";
import { webviewRefs } from "./_layout";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { PromoCard } from "@/components/PromoCard";
import { getPromos, type PromoRecord } from "@/src/lib/promos";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

  /* Hide Toasted Tuesday vape promo tile */
  a[aria-label*="TOASTED TUESDAY"],
  a[aria-label*="Toasted Tuesday"],
  a[href*="toasted"][href*="tuesday"],
  a[href*="Toasted"][href*="Tuesday"],
  div:has(> a[aria-label*="TOASTED TUESDAY"]),
  div:has(> a[aria-label*="Toasted Tuesday"]) {
    display: none !important;
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

      // Try cart badge selectors (works even when hidden with CSS)
      const badge = document.querySelector('.ec-cart-widget__count, .ec-minicart__count, .cart-count, [data-cart-count]');
      if (badge && badge.textContent) {
        const badgeCount = parseInt(badge.textContent.trim()) || 0;
        count = badgeCount;
      }

      // Always send the count
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CART_COUNT', count }));
    }

    // Check if element or its parents match ANY purchase button (Add to Bag, Add More, Checkout, etc.)
    // On Android, ALL purchase actions should open external browser
    function isPurchaseElement(element) {
      if (!element) return false;
      
      // Get the DIRECT text of the clicked element
      const directText = (element.innerText || element.textContent || '').toLowerCase().trim();
      
      // Check this element and up to 3 parent levels
      let el = element;
      for (let i = 0; i < 3 && el; i++) {
        const text = (el.innerText || el.textContent || '').toLowerCase().trim();
        const href = (el.getAttribute && el.getAttribute('href') || '').toLowerCase();
        const className = (el.className || '').toLowerCase();
        
        // Match ALL purchase-related buttons
        if (
          // Add to cart/bag buttons
          text.includes('add to bag') ||
          text.includes('add to cart') ||
          text.includes('add more') ||
          text.includes('add item') ||
          text === 'add' ||
          text.includes('buy now') ||
          // Checkout buttons
          text === 'go to checkout' ||
          text === 'proceed to checkout' ||
          text === 'checkout' ||
          text === 'view cart' ||
          text === 'view shopping cart' ||
          text === 'shopping cart' ||
          // CSS class matches
          className.includes('add-to-cart') ||
          className.includes('add-to-bag') ||
          className.includes('ec-product-browser__button') ||
          className.includes('form-control__button') ||
          // URL matches
          (href.includes('/cart') && !href.includes('add')) ||
          (href.includes('#cart') || href.includes('#!/cart')) ||
          (href.includes('checkout') && !href.includes('add'))
        ) {
          console.log('[Home JS] 🛒 Purchase button detected:', text || className);
          return true;
        }
        
        el = el.parentElement;
      }
      return false;
    }

    // Watch for checkout button clicks - INTERCEPT AND BLOCK
    function watchAddToBag() {
      // Debounce - only fire once per click
      let isTracking = false;

      // INTERCEPT clicks on checkout/cart buttons - use capture phase to get it first
      document.addEventListener('click', function(e) {
        if (isTracking) return;

        const target = e.target;
        if (!target) return;

        // Check if this is ANY purchase button (Add to Bag, Add More, Checkout, etc.)
        if (isPurchaseElement(target)) {
          console.log('[Home JS] 🛒 Purchase button clicked - opening in browser!');
          
          // BLOCK the navigation
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          isTracking = true;
          
          // Get the current URL - if we're on a product page, we'll open that
          let currentUrl = window.location.href;
          let productId = null;
          let productUrl = null;
          
          // Try to extract product ID from current URL
          // Ecwid URLs: #!/~/product/id=12345 or /product/Product-Name-p12345
          const hashMatch = currentUrl.match(/product\/id=(\d+)/i);
          const pathMatch = currentUrl.match(/-p(\d+)$/i);
          
          if (hashMatch) {
            productId = hashMatch[1];
          } else if (pathMatch) {
            productId = pathMatch[1];
          }
          
          // Try to get current product from Ecwid API
          if (window.Ecwid && window.Ecwid.Cart && window.Ecwid.Cart.get) {
            window.Ecwid.Cart.get(function(cart) {
              let cartCount = cart && cart.items ? cart.items.length : 0;
              let lastItem = cart && cart.items && cart.items.length > 0 ? cart.items[cart.items.length - 1] : null;
              
              // If we have a product ID from URL, use that
              if (productId) {
                productUrl = 'https://greenhauscc.com/products#!/~/product/id=' + productId;
                console.log('[Home JS] Opening product page:', productUrl);
              } 
              // Otherwise try to get the last added item
              else if (lastItem && lastItem.product && lastItem.product.id) {
                productUrl = 'https://greenhauscc.com/products#!/~/product/id=' + lastItem.product.id;
                console.log('[Home JS] Opening last added product:', productUrl);
              }
              // Fallback to store
              else {
                productUrl = 'https://greenhauscc.com/products';
                console.log('[Home JS] Opening store');
              }
              
              window.ReactNativeWebView.postMessage(JSON.stringify({ 
                type: 'OPEN_EXTERNAL_CHECKOUT',
                url: productUrl,
                productId: productId || (lastItem ? lastItem.product.id : null),
                productName: lastItem ? lastItem.product.name : null,
                cartCount: cartCount
              }));
            });
          } else {
            // Ecwid API not available - use URL-based detection
            if (productId) {
              productUrl = 'https://greenhauscc.com/products#!/~/product/id=' + productId;
            } else {
              productUrl = 'https://greenhauscc.com/products';
            }
            
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'OPEN_EXTERNAL_CHECKOUT',
              url: productUrl,
              productId: productId,
              cartCount: 0
            }));
          }
          
          // Also send analytics
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'START_ORDER' }));

          // Reset after 3 seconds
          setTimeout(function() {
            isTracking = false;
          }, 3000);
          
          return false;
        }
      }, true); // true = capture phase, fires before bubbling

      // Intercept XMLHttpRequest to update cart count
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalXHROpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
          if (this.status >= 200 && this.status < 300) {
            const url = this._url || '';
            if (url.includes('/cart') || url.includes('add-to-cart') || url.includes('bag')) {
              setTimeout(sendCartCount, 500);
            }
          }
        });
        return originalXHRSend.apply(this, arguments);
      };

      // Also intercept fetch requests as backup
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const promise = originalFetch.apply(this, args);
        const url = args[0]?.toString() || '';

        if (url.includes('/cart') || url.includes('add-to-cart') || url.includes('bag')) {
          promise.then(response => {
            if (response.ok) {
              setTimeout(sendCartCount, 500);
            }
            return response;
          }).catch(() => {});
        }

        return promise;
      };

      // Also watch for DOM mutations that might indicate cart update
      const cartObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          // Check if badge was updated
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              const badge = node.querySelector?.('.ec-cart-widget__count, .ec-minicart__count');
              if (badge) {
                sendCartCount();
              }
            }
          });
        });
      });

      // Observe the entire document for cart badge changes
      const headerArea = document.querySelector('header') || document.body;
      if (headerArea) {
        cartObserver.observe(headerArea, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['class']
        });
      }
    }

    // Intercept hash changes ONLY for full cart page navigation
    // NOT for cart popups or add-to-cart confirmations
    let lastHash = window.location.hash;
    let hashChangeBlocked = false;
    
    function checkHashChange() {
      if (hashChangeBlocked) return;
      
      const currentHash = window.location.hash.toLowerCase();
      if (currentHash !== lastHash) {
        const oldHash = lastHash;
        lastHash = currentHash;
        
        // Only trigger for EXPLICIT cart PAGE navigation
        // Ecwid cart page hash: #!/~/cart or #/~/cart
        // NOT: product pages, popups, etc.
        const isCartPageHash = (
          currentHash === '#!/~/cart' ||
          currentHash === '#/~/cart' ||
          currentHash === '#!/cart' ||
          currentHash.startsWith('#!/~/cart/') ||
          currentHash.startsWith('#/~/cart/') ||
          currentHash === '#!/~/checkout' ||
          currentHash.startsWith('#!/~/checkout/')
        );
        
        // Skip if coming from a product page (adding to cart shows popup, not cart page)
        const wasOnProduct = oldHash.includes('/product/') || oldHash.includes('#!/~/product');
        
        if (isCartPageHash && !wasOnProduct) {
          console.log('[Home JS] 🛒 Cart PAGE navigation detected - blocking:', currentHash);
          
          // Block cart/checkout navigation - just go back
          // The click interceptor already handles opening external browser
          hashChangeBlocked = true;
          setTimeout(() => { hashChangeBlocked = false; }, 3000);
          
          try { history.back(); } catch(e) {}
        } else {
          console.log('[Home JS] Hash changed:', oldHash, '->', currentHash);
        }
      }
    }
    
    // Listen for hash changes
    window.addEventListener('hashchange', checkHashChange);

    // Run immediately and on intervals
    sendCartCount();
    watchAddToBag();

    // More aggressive initial cart count check (every 500ms for first 5 seconds)
    let initialCheckCount = 0;
    const initialCheck = setInterval(() => {
      sendCartCount();
      initialCheckCount++;
      if (initialCheckCount >= 10) {
        clearInterval(initialCheck);
      }
    }, 500);

    setInterval(() => {
      sendCartCount();
    }, 2000);

    // Watch for DOM changes
    const observer = new MutationObserver(() => {
      sendCartCount();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  })();
  true;
`;

export default function HomeTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.home = ref;
  const { setCartCount, selectedStoreId } = useApp();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // WebView loading state
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const [currentWebViewUrl, setCurrentWebViewUrl] = useState('https://greenhauscc.com/');
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Force hide spinner after 10 seconds if WebView is stuck
  useEffect(() => {
    if (isLoading && !hasError) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('[Home] Loading timeout - showing retry button');
        setIsLoading(false);
        setRefreshing(false);
        setShowRetry(true);
      }, 25000); // 25 seconds before showing retry
    } else {
      setShowRetry(false);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [isLoading, hasError]);

  // Promo modal state
  const [promos, setPromos] = useState<PromoRecord[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [isModalOpen, setModalOpen] = useState(false);
  const dismissedForSession = useRef(false);
  const cycleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const promoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch promos
  const fetchPromos = useCallback(async () => {
    if (!selectedStoreId) {
      return;
    }

    try {
      setLoadingPromos(true);
      const items = await getPromos(selectedStoreId);
      setPromos(items);
      if (items.length > 0) {
        setCurrentPromoIndex(0);
      }
    } catch (error) {
      console.warn("[promos] failed to load", error);
      setPromos([]);
    } finally {
      setLoadingPromos(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  useEffect(() => {
    dismissedForSession.current = false;
  }, [selectedStoreId]);

  // Auto-show modal after delay
  useEffect(() => {
    if (promos.length > 0 && !dismissedForSession.current) {
      if (promoTimerRef.current) {
        clearTimeout(promoTimerRef.current);
      }
      promoTimerRef.current = setTimeout(() => {
        setModalOpen(true);
        promoTimerRef.current = null;
      }, 1200);
    }

    return () => {
      if (promoTimerRef.current) {
        clearTimeout(promoTimerRef.current);
        promoTimerRef.current = null;
      }
    };
  }, [promos]);

  // Auto-cycle promos in modal
  useEffect(() => {
    if (!isModalOpen || promos.length <= 1) {
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
      return;
    }

    if (cycleTimerRef.current) {
      clearInterval(cycleTimerRef.current);
    }

    cycleTimerRef.current = setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % promos.length);
    }, 4000);

    return () => {
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
    };
  }, [isModalOpen, promos]);

  useEffect(() => () => {
    if (promoTimerRef.current) {
      clearTimeout(promoTimerRef.current);
      promoTimerRef.current = null;
    }
    if (cycleTimerRef.current) {
      clearInterval(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
  }, []);

  const handleNextPromo = useCallback(() => {
    if (!promos.length) return;
    setCurrentPromoIndex((prev) => (prev + 1) % promos.length);
  }, [promos.length]);

  const handlePrevPromo = useCallback(() => {
    if (!promos.length) return;
    setCurrentPromoIndex((prev) => (prev - 1 + promos.length) % promos.length);
  }, [promos.length]);

  const closeModal = useCallback(() => {
    dismissedForSession.current = true;
    if (promoTimerRef.current) {
      clearTimeout(promoTimerRef.current);
      promoTimerRef.current = null;
    }
    setModalOpen(false);
  }, []);

  const openModal = useCallback(() => {
    if (!promos.length) return;
    setModalOpen(true);
  }, [promos.length]);

  useEffect(() => {
    if (currentPromoIndex >= promos.length && promos.length > 0) {
      setCurrentPromoIndex(0);
    }
  }, [currentPromoIndex, promos]);

  const currentPromo = promos[currentPromoIndex] ?? null;

  const openPromoUrl = useCallback((url: string) => {
    if (!ref.current) return;
    const script = `(() => { try { window.location.href = ${JSON.stringify(url)}; } catch (_) {} return true; })();`;
    ref.current.injectJavaScript(script);
  }, []);

  const handlePromoView = useCallback((url: string) => {
    openPromoUrl(url);
    closeModal();
  }, [openPromoUrl, closeModal]);

  const getCleanStoreName = useCallback((storeId?: string | null) => {
    if (!storeId) return 'STORE';

    if (storeId.includes('cookeville')) {
      return 'GREENHAUS COOKEVILLE';
    } else if (storeId.includes('crossville')) {
      return 'GREENHAUS CROSSVILLE';
    }

    return storeId.toUpperCase().replace(/-/g, ' ');
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    ref.current?.reload();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Open URL in external browser (works in Expo Go via Linking)
  const openInExternalBrowser = useCallback(async (url: string) => {
    console.log('[Home] Opening external browser:', url);
    
    try {
      // Use Chrome Custom Tabs for better UX
      const result = await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: '#1E4D3A',
        controlsColor: '#FFFFFF',
        showTitle: true,
      });
      console.log('[Home] ✅ WebBrowser result:', result.type);
    } catch (error) {
      console.log('[Home] WebBrowser failed, trying Linking:', error);
      try {
        await Linking.openURL(url);
        console.log('[Home] ✅ Opened via Linking');
      } catch (linkError) {
        console.log('[Home] ❌ Both methods failed:', linkError);
        Alert.alert(
          'Unable to Open Browser',
          'Please visit greenhauscc.com in your browser to complete your purchase.',
          [{ text: 'OK' }]
        );
      }
    }
  }, []);

  // Check if URL is a cart/checkout route
  const isCartOrCheckoutRoute = useCallback((url: string) => {
    const normalizedUrl = url.toLowerCase();
    return (
      normalizedUrl.includes('/cart') ||
      normalizedUrl.includes('/checkout') ||
      normalizedUrl.includes('/place-order') ||
      normalizedUrl.includes('/payment') ||
      normalizedUrl.includes('#cart') ||
      normalizedUrl.includes('#checkout') ||
      normalizedUrl.includes('#!/cart') ||
      normalizedUrl.includes('#!/checkout') ||
      normalizedUrl.includes('/products/cart')
    );
  }, []);

  // Intercept navigation BEFORE it happens
  const handleShouldStartLoadWithRequest = useCallback((request: WebViewNavigation) => {
    const url = request.url || '';
    const platformConfig = getPlatformConfig();
    
    // On Android where purchase flow is disabled, intercept cart/checkout and open external browser
    if (Platform.OS === 'android' && !platformConfig.allowPurchaseFlow && isCartOrCheckoutRoute(url)) {
      console.log('[Home] 🚫 Intercepting cart/checkout navigation:', url);
      
      // Use the last non-cart URL (the product page they were on)
      const urlToOpen = currentWebViewUrl || 'https://greenhauscc.com/products';
      console.log('[Home] Opening in browser:', urlToOpen);
      
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
      console.log('[Home] Cart/checkout detected in navigation state:', url);
      
      // On Android where purchase flow is disabled, open the current page in browser
      if (Platform.OS === 'android' && !platformConfig.allowPurchaseFlow) {
        // Use the last non-cart URL (the product page they were on)
        const urlToOpen = currentWebViewUrl || 'https://greenhauscc.com/products';
        console.log('[Home] Opening in browser:', urlToOpen);
        
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
    console.log('[Home] Retry button pressed - reloading WebView');
    setShowRetry(false);
    setHasError(false);
    setIsLoading(true);
    ref.current?.reload();
  };

  return (
    <View style={styles.container}>
      {hasError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Unable to Load Store</Text>
          <Text style={styles.errorText}>
            The emulator cannot connect to the internet.{'\n'}
            Try the other tabs to explore the app!
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              setIsLoading(true);
              ref.current?.reload();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {isLoading && !hasError && !showRetry && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5DB075" />
          <Text style={styles.loadingText}>Loading store...</Text>
        </View>
      )}
      {showRetry && !hasError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Page Taking Too Long</Text>
          <Text style={styles.errorText}>
            The store is taking longer than expected to load.{'\n'}
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
        source={{ uri: 'https://greenhauscc.com/' }}
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
        injectedJavaScriptBeforeContentLoaded={`
          (function() {
            const style = document.createElement('style');
            style.textContent = \`${INJECTED_CSS}\`;
            if (document.head) {
              document.head.appendChild(style);
            } else {
              document.addEventListener('DOMContentLoaded', function() {
                document.head.appendChild(style);
              });
            }
          })();
          true;
        `}
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
          ref.current?.injectJavaScript(INJECT_SCRIPT);
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error:', nativeEvent);
          setHasError(true);
          setIsLoading(false);
        }}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'CART_COUNT') {
              setCartCount(data.count);
            } else if (data.type === 'OPEN_EXTERNAL_CHECKOUT') {
              // Open external browser for checkout
              console.log('[Home] 📱 Received OPEN_EXTERNAL_CHECKOUT message:', data);
              
              const url = data.url || 'https://greenhauscc.com/products';
              const productName = data.productName;
              
              console.log('[Home] Opening URL:', url);
              console.log('[Home] Product name:', productName);
              
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
            console.log('[Home] Error parsing message:', e);
          }
        }}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#5DB075" />
          </View>
        )}
        startInLoadingState={false}
      />

      {promos.length > 0 && !isModalOpen && (
        <TouchableOpacity
          onPress={openModal}
          activeOpacity={0.85}
          style={[
            styles.fab,
            {
              bottom: Math.max(insets.bottom, 16) + 24,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Show promotions"
        >
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={styles.fabLabel}>Promos</Text>
          {promos.length > 1 && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{promos.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>CURRENT PROMOTIONS</Text>
                  <TouchableOpacity
                    onPress={closeModal}
                    style={styles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close promotions"
                    activeOpacity={0.6}
                  >
                    <Ionicons name="close" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {loadingPromos ? (
                  <View style={styles.skeletonCard}>
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLine} />
                    <View style={styles.skeletonLineShort} />
                  </View>
                ) : currentPromo ? (
                  <>
                    <PromoCard promo={currentPromo} onPressView={handlePromoView} getCleanStoreName={getCleanStoreName} />
                    {promos.length > 1 && (
                      <View style={styles.modalControls}>
                        <TouchableOpacity
                          onPress={handlePrevPromo}
                          style={styles.navButton}
                          accessibilityRole="button"
                          accessibilityLabel="Previous promotion"
                        >
                          <Ionicons name="chevron-back" size={20} color="#1E4D3A" />
                        </TouchableOpacity>
                        <View style={styles.dots}>
                          {promos.map((_, index) => (
                            <View
                              key={index}
                              style={[
                                styles.dot,
                                index === currentPromoIndex && styles.dotActive,
                              ]}
                            />
                          ))}
                        </View>
                        <TouchableOpacity
                          onPress={handleNextPromo}
                          style={styles.navButton}
                          accessibilityRole="button"
                          accessibilityLabel="Next promotion"
                        >
                          <Ionicons name="chevron-forward" size={20} color="#1E4D3A" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No promotions available right now.</Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorOverlay: {
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
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E4D3A',
    marginBottom: 12,
  },
  errorText: {
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
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1E4D3A",
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  fabLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 20, 13, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    width: "88%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E4D3A",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    right: 0,
    top: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  modalControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingTop: 4,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: "#1E4D3A",
    width: 20,
  },
  skeletonCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  skeletonLineWide: {
    height: 18,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    width: "70%",
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    width: "85%",
  },
  skeletonLineShort: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    width: "55%",
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
  },
});
