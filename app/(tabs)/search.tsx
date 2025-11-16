import React, { useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { webviewRefs } from "./_layout";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";

const INJECTED_CSS = `
  /* Hide vape content - more aggressive selectors */
  #ins-tile__category-item-GOrgE,
  a[aria-label*="TOASTED TUESDAY"],
  a[href*="toasted"][href*="tuesday"],
  .grid-category--id-180876996,
  a[href*="disposables"],
  a[href*="cartridges"],
  a[href*="Disposables"],
  a[href*="Cartridges"],
  [href*="/disposables"],
  [href*="/cartridges"],
  div:has(> a[href*="disposables"]),
  div:has(> a[href*="cartridges"]),
  /* Hide by text content */
  a:has(h2:contains("Disposables")),
  a:has(h2:contains("Cartridges")),
  /* Category tiles */
  .ec-grid__category-item:has(a[href*="disposables"]),
  .ec-grid__category-item:has(a[href*="cartridges"]),
  .grid-category:has(a[href*="disposables"]),
  .grid-category:has(a[href*="cartridges"]) {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    height: 0 !important;
    width: 0 !important;
    overflow: hidden !important;
  }

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

const INJECT_SCRIPT = `
  (function() {
    const style = document.createElement('style');
    style.textContent = \`${INJECTED_CSS}\`;
    document.head.appendChild(style);

    // JavaScript-based hiding for vape content
    function hideVapeContent() {
      // Find all links and check their href and text content
      document.querySelectorAll('a').forEach(link => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent || '';
        const ariaLabel = link.getAttribute('aria-label') || '';

        // Check if it's vape-related
        if (
          href.includes('disposable') ||
          href.includes('cartridge') ||
          href.includes('toasted') ||
          text.toLowerCase().includes('disposable') ||
          text.toLowerCase().includes('cartridge') ||
          text.toLowerCase().includes('toasted tuesday') ||
          ariaLabel.toLowerCase().includes('toasted tuesday')
        ) {
          // Hide the link and its parent container
          link.style.display = 'none';
          if (link.parentElement) {
            link.parentElement.style.display = 'none';
          }
        }
      });

      // Also hide headers, footers, and breadcrumbs
      ['header', 'footer', 'nav', '.site-header', '.site-footer', '.ins-header', '.ec-footer', '.breadcrumbs', '.ec-breadcrumbs'].forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          el.style.display = 'none';
        });
      });
    }

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

    // Watch for "Add to bag" button clicks and extract count from response
    function watchAddToBag() {
      // Intercept fetch requests to cart API
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const promise = originalFetch.apply(this, args);
        const url = args[0]?.toString() || '';

        // Check if it's a cart-related request
        if (url.includes('/cart') || url.includes('add-to-cart')) {
          promise.then(response => {
            if (response.ok) {
              // After successful cart addition, force check badge
              setTimeout(() => {
                sendCartCount();
              }, 500);
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

    // Run immediately and on DOM changes
    hideVapeContent();
    sendCartCount();
    watchAddToBag();
    setInterval(() => {
      hideVapeContent();
      sendCartCount();
    }, 2000);

    // Watch for DOM changes
    const observer = new MutationObserver(() => {
      hideVapeContent();
      sendCartCount();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  })();
  true;
`;

export default function SearchTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.search = ref;
  const router = useRouter();
  const { setCartCount } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        pullToRefreshEnabled={true}
        injectedJavaScript={INJECT_SCRIPT}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => {
          setIsLoading(false);
          setRefreshing(false);
          ref.current?.injectJavaScript(INJECT_SCRIPT);
        }}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'CART_COUNT') {
              setCartCount(data.count);
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
