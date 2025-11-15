import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import type { WebView } from 'react-native-webview';

interface SharedWebViewContextType {
  webviewRef: React.RefObject<WebView>;
  currentUrl: string;
  navigateTo: (url: string) => void;
  reload: () => void;
  webviewContainerRef: React.RefObject<View>;
}

const SharedWebViewContext = createContext<SharedWebViewContextType | null>(null);

export const SharedWebViewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const webviewRef = useRef<WebView>(null);
  const webviewContainerRef = useRef<View>(null);
  const [currentUrl, setCurrentUrl] = useState('https://greenhauscc.com/');

  const navigateTo = useCallback((url: string) => {
    console.log('[SharedWebView] 🧭 Navigating to:', url);
    setCurrentUrl(url);
    if (webviewRef.current) {
      // Determine if we should use Ecwid API or full navigation
      const isEcwidPage = url.includes('greenhauscc.com');
      
      if (isEcwidPage) {
        // Extract Ecwid page from URL and determine hash
        let ecwidHash = '';
        if (url.includes('/cart')) {
          ecwidHash = '#!/~/cart';
          console.log('[SharedWebView] 📍 Navigating to cart via hash (URL:', url, ')');
        } else if (url.includes('/products') && !url.match(/\/products\/.+-p\d+/)) {
          ecwidHash = '#!/~/search';
          console.log('[SharedWebView] 📍 Navigating to search via hash (URL:', url, ')');
        } else if (url.endsWith('greenhauscc.com/') || url.endsWith('greenhauscc.com')) {
          ecwidHash = '#!/';
          console.log('[SharedWebView] 📍 Navigating to home via hash (URL:', url, ')');
        }
        
        // Use hash-based navigation to preserve cart session
        // This is CRITICAL: Ecwid.openPage() creates a NEW cart, but hash navigation preserves the session
        webviewRef.current.injectJavaScript(`
          (function() {
            var targetHash = '${ecwidHash}';
            console.log('[Ecwid Nav] 🎯 Navigating to:', targetHash);
            console.log('[Ecwid Nav] 🔍 Current URL:', window.location.href);
            console.log('[Ecwid Nav] 🔍 Current hash:', window.location.hash);
            
            // Check cart BEFORE navigation
            if (window.Ecwid && window.Ecwid.Cart && window.Ecwid.Cart.get) {
              window.Ecwid.Cart.get(function(cart) {
                var beforeCount = cart?.productsQuantity || 0;
                var beforeCartId = cart?.cartId || 'none';
                console.log('[Ecwid Nav] 🛒 BEFORE nav - Cart:', beforeCount, 'items, cartId:', beforeCartId);
                
                // Now navigate using hash (preserves cart session)
                if (window.location.hash !== targetHash) {
                  console.log('[Ecwid Nav] ✅ Setting hash to:', targetHash);
                  window.location.hash = targetHash;
                  
                  // Verify cart persists AFTER navigation
                  setTimeout(function() {
                    if (window.Ecwid && window.Ecwid.Cart && window.Ecwid.Cart.get) {
                      window.Ecwid.Cart.get(function(cart) {
                        var afterCount = cart?.productsQuantity || 0;
                        var afterCartId = cart?.cartId || 'none';
                        console.log('[Ecwid Nav] 🛒 AFTER nav - Cart:', afterCount, 'items, cartId:', afterCartId);
                        
                        if (beforeCartId !== afterCartId) {
                          console.error('[Ecwid Nav] ⚠️ CartId CHANGED! Before:', beforeCartId, 'After:', afterCartId);
                        } else {
                          console.log('[Ecwid Nav] ✅ CartId preserved:', afterCartId);
                        }
                      });
                    }
                  }, 300);
                } else {
                  console.log('[Ecwid Nav] ℹ️ Already at target hash:', targetHash);
                }
              });
            } else {
              // Fallback if cart API not available
              console.warn('[Ecwid Nav] ⚠️ Cart API not available, navigating anyway');
              if (window.location.hash !== targetHash) {
                window.location.hash = targetHash;
              }
            }
            
            return true;
          })();
        `);
      } else {
        // For non-Ecwid URLs, use full navigation
        console.log('[SharedWebView] 🔗 Full navigation to non-Ecwid URL:', url);
        webviewRef.current.injectJavaScript(`
          (function() {
            if (window.location.href !== ${JSON.stringify(url)}) {
              console.log('[Nav] 🔄 Full page reload to:', ${JSON.stringify(url)});
              window.location.href = ${JSON.stringify(url)};
            }
          })();
          true;
        `);
      }
    }
  }, []);

  const reload = useCallback(() => {
    console.log('[SharedWebView] 🔄 Reloading');
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  }, []);

  const value = {
    webviewRef,
    currentUrl,
    navigateTo,
    reload,
    webviewContainerRef,
  };

  return (
    <SharedWebViewContext.Provider value={value}>
      {children}
    </SharedWebViewContext.Provider>
  );
};

export const useSharedWebView = () => {
  const context = useContext(SharedWebViewContext);
  if (!context) {
    throw new Error('useSharedWebView must be used within SharedWebViewProvider');
  }
  return context;
};

