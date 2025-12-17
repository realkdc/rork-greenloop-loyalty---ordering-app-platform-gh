import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
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

const INJECTED_CSS = `
  /* Hide header and footer only */
  header, .ins-header, .site-header,
  footer, .site-footer, .ec-footer,
  nav, .navigation, .site-nav,
  .breadcrumbs, .ec-breadcrumbs {
    display: none !important;
  }

  /* Add padding where header was */
  body { padding-top: 20px !important; }

  /* Hide Toasted Tuesday vape promo tile */
  a[aria-label*="TOASTED TUESDAY"],
  a[aria-label*="Toasted Tuesday"],
  a[aria-label*="toasted tuesday"],
  a[href*="toasted"][href*="tuesday"],
  a[href*="Toasted"][href*="Tuesday"],
  div:has(> a[aria-label*="TOASTED TUESDAY"]),
  div:has(> a[aria-label*="Toasted Tuesday"]),
  div:has(> a[href*="toasted"][href*="tuesday"]) {
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

      // Try cart badge selectors (works even when hidden with CSS)
      const badge = document.querySelector('.ec-cart-widget__count, .ec-minicart__count, .cart-count, [data-cart-count]');
      if (badge && badge.textContent) {
        const badgeCount = parseInt(badge.textContent.trim()) || 0;
        count = badgeCount;
      }

      // Always send the count
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CART_COUNT', count }));
    }

    // Watch for checkout button clicks
    function watchAddToBag() {
      // Debounce - only fire once per click
      let isTracking = false;

      // Track clicks on checkout buttons
      document.addEventListener('click', function(e) {
        if (isTracking) return; // Ignore if already tracking

        const target = e.target;
        if (!target) return;

        const text = (target.textContent || '').toLowerCase();
        const href = (target.getAttribute('href') || '').toLowerCase();
        const classList = target.className || '';

        // Check if it's a checkout button
        if (
          text.includes('checkout') ||
          text.includes('go to checkout') ||
          text.includes('proceed to checkout') ||
          href.includes('checkout') ||
          classList.includes('checkout')
        ) {
          isTracking = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'START_ORDER' }));

          // Reset after 1 second
          setTimeout(function() {
            isTracking = false;
          }, 1000);
        }
      }, true);

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

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url || '';

    // If navigated to cart page, switch to cart tab and reload it
    if (url.includes('/cart') || url.includes('/products/cart')) {
      // Reload cart tab to show updated items
      const cartRef = webviewRefs.cart?.current;
      if (cartRef) {
        cartRef.reload();
      }
      router.push('/(tabs)/cart');
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
        pullToRefreshEnabled={true}
        androidHardwareAccelerationDisabled={false}
        androidLayerType="hardware"
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
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
          ref.current?.injectJavaScript(INJECT_SCRIPT);
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error:', nativeEvent);
          setHasError(true);
          setIsLoading(false);
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
