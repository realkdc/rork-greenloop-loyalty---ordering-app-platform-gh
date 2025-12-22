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

  // Only show retry after very long load (30 seconds)
  useEffect(() => {
    if (isLoading && !hasError) {
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
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        androidLayerType="hardware"
        sharedCookiesEnabled={true}
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
