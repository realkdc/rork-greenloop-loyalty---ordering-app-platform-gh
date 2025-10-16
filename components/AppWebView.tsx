import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { useRouter } from 'expo-router';
import { INJECTED_CSS } from '@/lib/webviewSkin';

import { matchRoute } from '@/config/greenhaus';
import { useApp } from '@/contexts/AppContext';

interface AppWebViewProps {
  initialUrl: string;
  webViewRef?: React.RefObject<WebView | null>;
}

const AppWebView = forwardRef<WebView, AppWebViewProps>(({ initialUrl, webViewRef }, ref) => {
  const { setCartCount } = useApp();
  const internalRef = useRef<WebView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const actualRef = webViewRef || internalRef;

  useImperativeHandle(ref, () => actualRef.current as WebView);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[AppWebView] 📨 Message received:', data);
      
      if (data.type === 'CART_COUNT' || data.type === 'CART') {
        const count = Number(data.value ?? data.count ?? 0);
        const normalized = isFinite(count) ? Math.max(0, Math.min(999, count)) : 0;
        console.log('[AppWebView] 📊 Cart count update:', normalized, 'from:', data, '| calling setCartCount...');
        setCartCount(normalized);
        console.log('[AppWebView] ✅ setCartCount called');
      }

      if (data.type === 'ROUTE_HINT') {
        console.log('📍 Route hint:', data.value, 'from URL:', data.url);
        
        switch (data.value) {
          case 'CART':
            router.push('/(tabs)/cart');
            break;
          case 'ORDERS':
            router.push('/(tabs)/orders');
            break;
          case 'PROFILE':
            router.push('/(tabs)/profile');
            break;
        }
      }

      if (data.type === 'LOYALTY_HINT') {
        console.log('💎 Loyalty hint:', data.value);
      }
    } catch (error) {
      console.log('WebView message parse error:', error);
    }
  }, [setCartCount, router]);

  const handleNavigationStateChange = useCallback((navState: any) => {
    const url = navState.url;
    console.log('🔗 Navigation:', url);

    const routeType = matchRoute(url);
    console.log('📍 Route type:', routeType);
    
    switch (routeType) {
      case 'cart':
        if (!url.includes('/(tabs)/cart')) {
          console.log('🛒 → Switching to Cart tab');
          setTimeout(() => {
            router.push('/(tabs)/cart');
          }, 100);
        }
        break;
      case 'orders':
        if (!url.includes('/(tabs)/orders')) {
          console.log('📦 → Switching to Orders tab');
          router.push('/(tabs)/orders');
        }
        break;
      case 'profile':
        if (!url.includes('/(tabs)/profile')) {
          console.log('👤 → Switching to Profile tab');
          router.push('/(tabs)/profile');
        }
        break;
    }
  }, [router]);

  const handleShouldStartLoad = useCallback((request: any) => {
    const url = request.url;
    const isGreenhaus = url.includes('greenhauscc.com');
    const isMainFrame = request.isTopFrame !== false;
    
    console.log('🔍 Should start load:', url, '| isTopFrame:', isMainFrame, '| navigationType:', request.navigationType);
    
    if (isGreenhaus) {
      console.log('✅ Allowing Greenhaus URL in WebView');
      return true;
    }
    
    if (url.startsWith('about:blank') || url.startsWith('data:')) {
      return true;
    }
    
    console.log('⚠️ External URL detected, blocking:', url);
    return false;
  }, []);

  const preventTargetBlank = `
    (function() {
      const originalWindowOpen = window.open;
      window.open = function(url, target, features) {
        console.log('window.open intercepted:', url);
        if (url && url.includes('greenhauscc.com')) {
          window.location.href = url;
          return null;
        }
        return originalWindowOpen.call(this, url, target, features);
      };
      
      document.addEventListener('click', function(e) {
        let target = e.target;
        while (target && target.tagName !== 'A') {
          target = target.parentElement;
        }
        if (target && target.tagName === 'A') {
          const href = target.getAttribute('href');
          const targetAttr = target.getAttribute('target');
          if (href && href.includes('greenhauscc.com') && targetAttr === '_blank') {
            console.log('Preventing _blank on Greenhaus link:', href);
            e.preventDefault();
            window.location.href = href;
          }
        }
      }, true);
    })();
  `;

  const cssInjection = `
    (function(){
      var s=document.createElement('style'); s.type='text/css';
      s.appendChild(document.createTextNode(\`${INJECTED_CSS}\`));
      if (document.head) {
        document.head.appendChild(s);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          if (document.head) document.head.appendChild(s);
        });
      }
    })(); true;
  `;

  const cartCounterScript = `
    (function(){
      if (window.__ghCC?.installed) return;
      window.__ghCC = { installed: true, active: true, lastSent: undefined, timer: null, lastCount: 0 };

      const d = document;
      const q  = (sel) => d.querySelector(sel);
      const qAll = (sel) => d.querySelectorAll(sel);

      function parseIntSafe(x){
        const n = parseInt(String(x).trim(),10);
        return Number.isFinite(n) ? n : null;
      }

      function readCountSync(){
        let n = null;
        
        // Try all possible selectors aggressively
        const selectors = [
          'a[href*="cart"] .ec-minicart__counter',
          '.ec-cart-widget__counter',
          '.ec-minicart__counter',
          '[data-cart-count]',
          'a.ins-header__icon.ins-header__icon--cart[data-count]',
          '.cart-counter',
          '.shopping-bag__count',
          'a[href*="/cart"] span[class*="count"]',
          'a[href*="/cart"] span[class*="badge"]'
        ];

        for (const sel of selectors) {
          const el = q(sel);
          if (el) {
            const text = el.textContent?.trim() || '';
            const dataCount = el.getAttribute('data-count') || el.getAttribute('data-cart-count');
            n = parseIntSafe(dataCount || text);
            if (n !== null && n >= 0) {
              console.log('[GH Cart] Found via', sel, '→', n);
              return n;
            }
          }
        }

        // Check text content for "Shopping bag (N)"
        const bag = Array.from(qAll('a,button,li,span,div')).find(e => /shopping bag\\s*\\((\\d+)\\)/i.test(e.textContent||''));
        if (bag) {
          const match = bag.textContent.match(/\\((\\d+)\\)/);
          n = parseIntSafe(match ? match[1] : null);
          if (n !== null && n >= 0) {
            console.log('[GH Cart] Found via text "Shopping bag (N)"→', n);
            return n;
          }
        }

        // On cart page, count items
        if (/\\/cart/i.test(location.pathname) || /\\/products\\/cart/i.test(location.pathname)) {
          const items = qAll('.ec-cart__products li, [data-cart-item], .cart__item, .ec-cart-item');
          if (items.length > 0) {
            console.log('[GH Cart] Cart page items:', items.length);
            return items.length;
          }
        }

        console.log('[GH Cart] No sync count found');
        return null;
      }

      function postCount(value, force=false){
        if (!window.__ghCC.active && !force) return;
        
        // If value is null/undefined, keep last known count
        const finalValue = (value === null || value === undefined) ? window.__ghCC.lastCount : value;
        
        const payload = { type:'CART_COUNT', value: finalValue, source: location.pathname };
        const same = JSON.stringify(payload) === JSON.stringify(window.__ghCC.lastSent);
        if (!force && same) return;
        
        window.__ghCC.lastSent = payload;
        window.__ghCC.lastCount = finalValue;
        console.log('[GH Cart] Posting to RN:', payload);
        
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function tryEcwidAPI(){
        if (window.Ecwid?.Cart?.calculateTotal) {
          try {
            const cart = window.Ecwid.Cart.calculateTotal();
            const count = cart?.productsQuantity ?? cart?.items?.length ?? null;
            if (count !== null && count >= 0) {
              console.log('[GH Cart] Ecwid Cart.calculateTotal:', count);
              postCount(count, true);
              return;
            }
          } catch(e) {
            console.log('[GH Cart] Ecwid calculateTotal error:', e);
          }
        }
        
        if (window.Ecwid?.getCart) {
          try {
            window.Ecwid.getCart(function(cart) {
              const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
              console.log('[GH Cart] Ecwid getCart callback:', count);
              postCount(count, true);
            });
          } catch(e) {
            console.log('[GH Cart] Ecwid getCart error:', e);
          }
        }
      }

      function checkCount(){
        const n = readCountSync();
        if (n !== null && n >= 0) {
          postCount(n, false);
        } else {
          // Try Ecwid API
          tryEcwidAPI();
        }
      }

      const debouncedCheck = (()=> {
        let t; 
        return ()=>{ 
          clearTimeout(t); 
          t=setTimeout(checkCount, 300); 
        }
      })();

      const mo = new MutationObserver(debouncedCheck);
      mo.observe(d.documentElement, { childList:true, subtree:true, attributes:true });

      ['pageshow','visibilitychange','popstate','hashchange'].forEach(ev => 
        addEventListener(ev, debouncedCheck, {passive:true})
      );

      // Poll aggressively on startup
      [100, 500, 1000, 2000, 3000].forEach(delay => {
        setTimeout(()=>{
          checkCount();
          tryEcwidAPI();
        }, delay);
      });

      // Listen for Ecwid events
      if (window.Ecwid) {
        window.Ecwid.OnCartChanged = window.Ecwid.OnCartChanged || {};
        window.Ecwid.OnCartChanged.add = window.Ecwid.OnCartChanged.add || function(){};
        try {
          window.Ecwid.OnCartChanged.add(function(cart){
            const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
            console.log('[GH Cart] Ecwid OnCartChanged event:', count);
            postCount(count, true);
          });
        } catch(e) {
          console.log('[GH Cart] OnCartChanged.add error:', e);
        }
      }

      addEventListener('message', (e)=>{
        let msg;
        try { 
          msg = JSON.parse(String(e.data||'{}')); 
        } catch { 
          return; 
        }
        if (msg.type === 'TAB_ACTIVE') { 
          window.__ghCC.active = !!msg.value; 
          checkCount();
        }
        if (msg.type === 'PING') { 
          checkCount();
          tryEcwidAPI();
        }
      });
    })();
  `;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="appWebViewContainer">
      <WebView
        ref={actualRef}
        source={{ uri: initialUrl }}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        setSupportMultipleWindows={false}
        decelerationRate="normal"
        applicationNameForUserAgent="GreenLoopApp/1.0"
        allowsBackForwardNavigationGestures={Platform.OS === 'ios'}
        bounces={true}
        scrollEnabled={true}
        injectedJavaScriptBeforeContentLoaded={`${preventTargetBlank}\n${cssInjection}`}
        injectedJavaScript={`
          ${preventTargetBlank}
          ${cartCounterScript}
          true;
        `}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="compatibility"
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        cacheEnabled={true}
        incognito={false}
        pullToRefreshEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading} testID="webviewLoading">
            <ActivityIndicator size="large" color="#1E4D3A" />
          </View>
        )}
        testID="appWebView"
        style={styles.webview}
      />
    </View>
  );
});

AppWebView.displayName = 'AppWebView';

export default AppWebView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
