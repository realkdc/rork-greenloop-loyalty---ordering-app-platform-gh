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
      
      if (data.type === 'CART_COUNT' || data.type === 'CART') {
        const count = Number(data.value ?? data.count ?? 0);
        const normalized = isFinite(count) ? Math.max(0, Math.min(999, count)) : 0;
        console.log('📊 Cart count update:', normalized, 'from:', data);
        setCartCount(normalized);
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
      window.__ghCC = { installed: true, active: true, lastSent: undefined, timer: null };

      const d = document;
      const q  = (sel) => d.querySelector(sel);
      const qAll = (sel) => d.querySelectorAll(sel);

      function parseIntSafe(x){
        const n = parseInt(String(x).trim(),10);
        return Number.isFinite(n) ? n : null;
      }

      function readCount(){
        let n = null;

        const el = q('a.ins-header__icon.ins-header__icon--cart[data-count]');
        if (el) {
          n = parseIntSafe(el.getAttribute('data-count'));
        }

        if (n === null) {
          const bag = Array.from(qAll('a,button,li')).find(e => /shopping bag\\s*\\((\\d+)\\)/i.test(e.textContent||''));
          if (bag) n = parseIntSafe((bag.textContent.match(/\\((\\d+)\\)/)||[])[1]);
        }

        if (n === null && /\\/products\\/cart/i.test(location.pathname)) {
          const items = qAll('.ec-cart__products li, [data-cart-item], .cart__item');
          n = parseIntSafe(items.length);
        }

        if (n === null) {
          const w = q('.ec-cart-widget__counter, .cart-counter, [data-cart-count]');
          if (w) n = parseIntSafe(w.getAttribute('data-cart-count') || w.textContent);
        }

        if (n === null && window.Ecwid?.getCart) {
          try {
            window.Ecwid.getCart(function(cart) {
              const count = cart?.productsQuantity || 0;
              postCount(count, true);
            });
          } catch(_e) {}
        }

        return n;
      }

      function postCount(value, force=false){
        if (!window.__ghCC.active && !force) return;
        const payload = { type:'CART_COUNT', value, source: location.pathname };
        const same = JSON.stringify(payload) === JSON.stringify(window.__ghCC.lastSent);
        if (!force && same) return;
        window.__ghCC.lastSent = payload;
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      const debouncedPost = (()=> {
        let t; 
        return ()=>{ 
          clearTimeout(t); 
          t=setTimeout(()=>{
            const n = readCount();
            if (n !== null) postCount(n, false);
          }, 300); 
        }
      })();

      const mo = new MutationObserver(debouncedPost);
      mo.observe(d.documentElement, { childList:true, subtree:true, attributes:true });

      ['pageshow','visibilitychange','popstate','hashchange'].forEach(ev => 
        addEventListener(ev, debouncedPost, {passive:true})
      );

      setTimeout(()=>{
        const n = readCount();
        if (n !== null) postCount(n, true);
      }, 50);

      addEventListener('message', (e)=>{
        let msg;
        try { 
          msg = JSON.parse(String(e.data||'{}')); 
        } catch { 
          return; 
        }
        if (msg.type === 'TAB_ACTIVE') { 
          window.__ghCC.active = !!msg.value; 
          const n = readCount();
          if (n !== null) postCount(n, true); 
        }
        if (msg.type === 'PING') { 
          const n = readCount();
          if (n !== null) postCount(n, true); 
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
