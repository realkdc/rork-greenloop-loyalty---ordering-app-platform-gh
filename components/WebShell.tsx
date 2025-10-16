import { forwardRef, useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView, WebViewProps } from 'react-native-webview';
import { useApp } from '@/contexts/AppContext';
import { useRouter } from 'expo-router';

const INJECTED_CSS = `
(function(){
  const css = \`
    /* REVERT hero slider hiding: show it again */
    .ins-tile__wrap, .ins-tile__slide, .ins-tile__slide-content-inner { display: initial !important; opacity: initial !important; }

    /* Keep it clean & app-like */
    /* 1) Hide breadcrumbs */
    .ec-breadcrumbs, [class*="breadcrumbs"] { display: none !important; }
    /* 2) Hide the quick-link grid above the footer */
    .ec-store .ec-footer, .ec-store .footer__links { display: none !important; }
    .ec-store .footer, .ec-store .footer__spacer { display: none !important; }

    /* 3) Hide site header/footer chrome when it leaks in WebView transitions */
    header, .ins-header, .site-header { display: none !important; }
    footer, .site-footer { display: none !important; }

    /* 4) Fix top spacing: add padding where header was */
    body { padding-top: 60px !important; }
    main, .ec-store { padding-bottom: 16px !important; }
  \`;
  const s = document.createElement('style'); s.type='text/css'; s.appendChild(document.createTextNode(css));
  document.documentElement.appendChild(s);
})();
true;
`;

const CART_COUNTER_SCRIPT = `
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

    // Test 1: Header badge - PRIMARY METHOD
    const el = q('a.ins-header__icon.ins-header__icon--cart[data-count]');
    if (el) {
      const attr = el.getAttribute('data-count');
      n = parseIntSafe(attr);
      console.log('[GH Cart] Header badge data-count:', attr, '→', n);
    }

    // Test 2: Footer quick-link text
    if (n === null) {
      const bag = Array.from(qAll('a,button,li')).find(e => /shopping bag\\s*\\((\\d+)\\)/i.test(e.textContent||''));
      if (bag) {
        const match = bag.textContent.match(/\\((\\d+)\\)/);
        n = parseIntSafe(match ? match[1] : null);
        console.log('[GH Cart] Footer bag text:', bag.textContent, '→', n);
      }
    }

    // Test 3: Cart page item count
    if (n === null && /\\/products\\/cart/i.test(location.pathname)) {
      const items = qAll('.ec-cart__products li, [data-cart-item], .cart__item');
      n = items.length > 0 ? items.length : 0;
      console.log('[GH Cart] Cart page items:', items.length, '→', n);
    }

    // Test 4: Mini widget counters
    if (n === null) {
      const w = q('.ec-cart-widget__counter, .cart-counter, [data-cart-count]');
      if (w) {
        n = parseIntSafe(w.getAttribute('data-cart-count') || w.textContent);
        console.log('[GH Cart] Widget counter:', w, '→', n);
      }
    }

    // Test 5: Ecwid API - ASYNC FALLBACK
    if (n === null && window.Ecwid?.getCart) {
      try {
        window.Ecwid.getCart(function(cart) {
          const count = cart?.productsQuantity || 0;
          console.log('[GH Cart] Ecwid getCart:', count);
          postCount(count, true);
        });
      } catch(e) {
        console.log('[GH Cart] Ecwid error:', e);
      }
    }

    if (n === null) {
      console.log('[GH Cart] No count found, defaulting to 0');
      n = 0;
    }

    return n;
  }

  function postCount(value, force=false){
    if (!window.__ghCC.active && !force) return;
    const payload = { type:'CART_COUNT', value, source: location.pathname };
    const same = JSON.stringify(payload) === JSON.stringify(window.__ghCC.lastSent);
    if (!force && same) return;
    window.__ghCC.lastSent = payload;
    console.log('[GH Cart] Posting to RN:', payload);
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
        postCount(n, false);
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
    postCount(n, true);
  }, 100);

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
      postCount(n, true); 
    }
    if (msg.type === 'PING') { 
      const n = readCount();
      postCount(n, true); 
    }
  });
})();
`;

const INJECTED_JS = `
(function(){
  let lastBodyText = '';
  const loginObserver = new MutationObserver(function(){
    try{
      const bodyText = document.body.innerText || '';
      if(bodyText === lastBodyText) return;
      lastBodyText = bodyText;
      
      if(/link.*has.*been.*sent|check.*your.*email|sent.*you.*link|email.*sent|we.*sent.*you/i.test(bodyText)){
        console.log('[Auth] Email confirmation detected');
        window.ReactNativeWebView?.postMessage(JSON.stringify({type:'EMAIL_LINK_SENT'}));
      }
    }catch(e){}
  });
  if(document.body){
    loginObserver.observe(document.body, {subtree: true, childList: true});
  }
  
  setTimeout(function(){
    try{
      const bodyText = document.body.innerText || '';
      if(/link.*has.*been.*sent|check.*your.*email|sent.*you.*link|email.*sent|we.*sent.*you/i.test(bodyText)){
        console.log('[Auth] Email confirmation already visible');
        window.ReactNativeWebView?.postMessage(JSON.stringify({type:'EMAIL_LINK_SENT'}));
      }
    }catch(e){}
  }, 1000);
  
  function checkNav(){
    try{
      const url = window.location.href;
      
      if(/\\/cart/i.test(url) || /\\/products\\/cart/i.test(url)){
        window.ReactNativeWebView?.postMessage(JSON.stringify({type:'NAVIGATE_TAB', tab:'cart'}));
      }
      else if(/\\/checkout/i.test(url) || url.includes('#checkout')){
        window.ReactNativeWebView?.postMessage(JSON.stringify({type:'NAVIGATE_TAB', tab:'cart'}));
      }
      else if(/\\/account/i.test(url) || /\\/profile/i.test(url)){
        if(/\\/orders/i.test(url)){
          window.ReactNativeWebView?.postMessage(JSON.stringify({type:'NAVIGATE_TAB', tab:'orders'}));
        } else {
          window.ReactNativeWebView?.postMessage(JSON.stringify({type:'NAVIGATE_TAB', tab:'profile'}));
        }
      }
    }catch(e){}
  }
  
  let lastUrl = window.location.href;
  setInterval(function(){
    if(window.location.href !== lastUrl){
      lastUrl = window.location.href;
      checkNav();
    }
  }, 300);
  
  checkNav();
  
  window.addEventListener('hashchange', function(){
    setTimeout(checkNav, 100);
  });
  
  window.addEventListener('popstate', function(){
    setTimeout(checkNav, 100);
  });
  
  document.addEventListener('click', function(e){
    try{
      const target = e.target;
      const el = target.closest('a, button, [role="button"]');
      if(el){
        const text = (el.textContent || '').toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        const onclick = (el.getAttribute('onclick') || '').toLowerCase();
        
        if(/browse.*store|continue.*shopping|shop.*now/i.test(text) && window.location.href.includes('/cart')){
          e.preventDefault();
          e.stopPropagation();
          window.ReactNativeWebView?.postMessage(JSON.stringify({type:'NAVIGATE_TAB', tab:'search'}));
          return;
        }
        
        if(
          /checkout|view.*cart|go.*to.*cart|shopping.*bag|proceed.*to.*checkout/i.test(text) ||
          /\\/cart|checkout|shopping-bag/i.test(href) ||
          /cart|checkout/i.test(onclick)
        ){
          setTimeout(checkNav, 200);
          setTimeout(checkNav, 500);
          setTimeout(checkNav, 1000);
        }
      }
    }catch(e){}
  }, true);
  
  document.addEventListener('submit', function(e){
    try{
      const form = e.target;
      if(form && form.action){
        const action = form.action.toLowerCase();
        if(/cart|checkout/i.test(action)){
          setTimeout(checkNav, 500);
        }
      }
    }catch(e){}
  }, true);
})();
true;
`;

interface WebShellProps extends Omit<WebViewProps, 'source'> {
  initialUrl: string;
  tabKey: 'home' | 'search' | 'cart' | 'orders' | 'profile';
}

export const WebShell = forwardRef<WebView, WebShellProps>(
  ({ initialUrl, tabKey, ...props }, ref) => {
    const { setCartCount } = useApp();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const webviewRef = useRef<WebView>(null);
    const isActiveRef = useRef(false);
    const isMountedRef = useRef(true);

    const handleMessage = useCallback((event: any) => {
      try {
        const rawData = event.nativeEvent.data || '{}';
        console.log(`[WebShell:${tabKey}] 📨 Raw message received:`, rawData);
        
        const msg = JSON.parse(rawData);
        console.log(`[WebShell:${tabKey}] 📨 Parsed message:`, msg);
        
        if (msg.type === 'CART_COUNT' || msg.type === 'CART') {
          const count = Number(msg.value ?? msg.count ?? 0);
          const normalized = isFinite(count) ? Math.max(0, Math.min(999, count)) : 0;
          console.log(`[WebShell:${tabKey}] 📊 Cart count received:`, normalized, 'raw:', msg);
          setCartCount(normalized);
        } else if (msg.type === 'NAVIGATE_TAB') {
          if (msg.tab && msg.tab !== tabKey) {
            console.log(`[WebShell:${tabKey}] 🧭 Navigating to tab:`, msg.tab);
            router.push(`/(tabs)/${msg.tab}` as any);
          }
        } else if (msg.type === 'EMAIL_LINK_SENT') {
          console.log(`[WebShell:${tabKey}] 📧 Email link sent detected`);
        } else {
          console.log(`[WebShell:${tabKey}] 📨 Unknown message type:`, msg.type);
        }
        
        if (props.onMessage) {
          props.onMessage(event);
        }
      } catch (error) {
        console.error(`[WebShell:${tabKey}] ❌ Message parse error:`, error, 'raw data:', event.nativeEvent.data);
      }
    }, [setCartCount, router, tabKey, props]);

    const handleError = useCallback((syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      console.error('WebView error:', nativeEvent);
      setError(`Failed to load ${tabKey}`);
      setIsLoading(false);
    }, [tabKey]);

    const handleLoadStart = useCallback(() => {
      setIsLoading(true);
      setError(null);
    }, []);

    const handleLoadEnd = useCallback(() => {
      setIsLoading(false);
    }, []);

    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
    }, []);

    useEffect(() => {
      const handleAppStateChange = (nextAppState: string) => {
        if (nextAppState === 'active' && isActiveRef.current) {
          const actualRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
          if (actualRef) {
            actualRef.postMessage(JSON.stringify({ type: 'PING' }));
          }
        }
      };

      const subscription = AppState.addEventListener('change', handleAppStateChange);
      return () => subscription.remove();
    }, [ref]);

    useFocusEffect(
      useCallback(() => {
        console.log(`[WebShell:${tabKey}] 🎯 Tab focused`);
        isActiveRef.current = true;
        const actualRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
        if (actualRef && isMountedRef.current) {
          console.log(`[WebShell:${tabKey}] 📤 Sending TAB_ACTIVE=true`);
          actualRef.postMessage(JSON.stringify({ type: 'TAB_ACTIVE', value: true }));
          
          // Also send a PING to trigger immediate cart count check
          setTimeout(() => {
            console.log(`[WebShell:${tabKey}] 📤 Sending PING for cart check`);
            actualRef.postMessage(JSON.stringify({ type: 'PING' }));
          }, 100);
        }
        return () => {
          console.log(`[WebShell:${tabKey}] 👋 Tab blurred`);
          isActiveRef.current = false;
          const actualRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
          if (actualRef) {
            console.log(`[WebShell:${tabKey}] 📤 Sending TAB_ACTIVE=false`);
            actualRef.postMessage(JSON.stringify({ type: 'TAB_ACTIVE', value: false }));
          }
        };
      }, [ref, tabKey])
    );

    if (!initialUrl || initialUrl.trim() === '') {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invalid URL for {tabKey} tab</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubtext}>Pull down to retry</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <WebView
          ref={(r) => {
            if (ref) {
              if (typeof ref === 'function') ref(r);
              else ref.current = r;
            }
            webviewRef.current = r;
          }}
          source={{ uri: initialUrl }}
          sharedCookiesEnabled
          {...(Platform.OS === 'ios' ? { useSharedProcessPool: true } : {})}
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          incognito={false}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures={false}
          pullToRefreshEnabled={false}
          injectedJavaScriptBeforeContentLoaded={INJECTED_CSS}
          injectedJavaScript={`
            ${INJECTED_CSS}
            ${CART_COUNTER_SCRIPT}
            ${INJECTED_JS}
          `}
          onMessage={handleMessage}
          onError={handleError}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22c55e" />
            </View>
          )}
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowFileAccess
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          {...props}
        />
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#22c55e" />
          </View>
        )}
      </View>
    );
  }
);

WebShell.displayName = 'WebShell';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});
