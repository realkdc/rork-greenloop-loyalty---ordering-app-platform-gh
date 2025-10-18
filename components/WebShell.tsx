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
  console.log('[CartCounter] 🚀 Starting cart counter script');
  if (window.__ghCartCounter?.installed) {
    console.log('[CartCounter] ⏭️ Already installed, skipping');
    return;
  }
  let persisted = -1;
  try { persisted = parseInt(sessionStorage.getItem('__ghLastCount')||''); } catch {}
  window.__ghCartCounter = { installed:true, lastValue: Number.isFinite(persisted)&&persisted>0?persisted:0, active: true, ready:false, confirmedEmpty:false, synced:false, pending:null };
  window.__ghCC = window.__ghCartCounter;
  console.log('[CartCounter] ✅ Initialized with persisted value:', window.__ghCartCounter.lastValue);
  
  function isCartPage(){ return /\\/cart(\\b|\\/|$)/i.test(location.pathname) || /#checkout/i.test(location.hash); }
  function persist(n){ try{ sessionStorage.setItem('__ghLastCount', String(n)); }catch{} }
  function parseSafe(n){ const v=parseInt(n,10); return Number.isFinite(v)&&v>=0?v:null; }
  function domProbe(){
    const sel=[
      'a[href*="cart"] .ec-minicart__counter',
      '.ec-cart-widget__counter',
      '.ec-minicart__counter',
      'a.ins-header__icon.ins-header__icon--cart[data-count]',
      '[data-cart-count]',
      '.cart-counter',
      'a[href*="/cart"] span[class*="count"]',
      'a[href*="/cart"] span[class*="badge"]',
      '.ec-cart-count',
      '.shopping-bag__count'
    ];
    for (const s of sel){
      const el = document.querySelector(s);
      if (!el) continue;
      const raw = el.getAttribute('data-count')||el.getAttribute('data-cart-count')||(el.textContent||'').trim();
      const n = parseSafe(raw);
      if (n!==null) {
        console.log('[CartCounter] 🎯 Found cart count via DOM selector:', s, '= value:', n);
        return n;
      }
    }
    if (isCartPage()){
      const items = document.querySelectorAll('.ec-cart__products li, [data-cart-item], .cart__item, .ec-cart-item');
      if (items.length>0) {
        console.log('[CartCounter] 🎯 Found cart items on cart page:', items.length);
        return items.length;
      }
    }
    console.log('[CartCounter] ❌ No cart count found via DOM probe');
    return null;
  }
  function post(rawValue, fromAPI){
    const state = window.__ghCartCounter;
    console.log('[CartCounter] 📤 post() called - value:', rawValue, 'fromAPI:', fromAPI, 'active:', state.active, 'synced:', state.synced, 'lastValue:', state.lastValue);

    let n = rawValue;
    if (n === null || n === undefined){
      if (!state.ready){
        console.log('[CartCounter] ⚠️ Not ready and no value, skipping');
        return;
      }
      n = state.lastValue;
      console.log('[CartCounter] Using last known value:', n);
    }

    const prev = state.lastValue;
    if (n === 0 && prev > 0 && isCartPage() && !state.confirmedEmpty && !fromAPI){
      console.log('[CartCounter] ⚠️ On cart page with 0 items but not confirmed, skipping');
      return;
    }
    if (n === 0 && !state.ready && !fromAPI){
      console.log('[CartCounter] ⏭️ Ignoring zero before ready state');
      return;
    }

    if (fromAPI){
      state.ready = true;
      state.confirmedEmpty = n === 0;
    }
    if (n > 0){
      state.ready = true;
      state.confirmedEmpty = false;
    }

    state.lastValue = n;
    if (n !== prev) {
      state.synced = false;
    }

    const unchanged = state.synced && n === prev;
    if (unchanged && !fromAPI){
      console.log('[CartCounter] ⏭️ Value unchanged and already synced, skipping');
      return;
    }

    persist(n);

    const now = Date.now();
    if (!state.pending || state.pending.value !== n) {
      state.pending = { value: n, firstAttempt: now, attempts: 0 };
    }
    const pending = state.pending;

    function scheduleRetry(delay){
      setTimeout(function(){ post(n, fromAPI); }, delay);
    }

    if (!window.ReactNativeWebView){
      pending.attempts += 1;
      if (now - pending.firstAttempt > 15000){
        console.log('[CartCounter] 🛑 Bridge not ready after multiple attempts, giving up');
        state.pending = null;
        return;
      }
      console.log('[CartCounter] ⚠️ Bridge not ready (attempt ' + pending.attempts + ') - retrying');
      scheduleRetry(Math.min(1200, 200 + pending.attempts * 200));
      return;
    }

    try{
      console.log('[CartCounter] 📢 Sending CART_COUNT message to React Native with value:', n);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type:'CART_COUNT', value:n }));
      state.synced = true;
      state.pending = null;
    }catch(e){
      const retryNow = Date.now();
      pending.attempts += 1;
      if (retryNow - pending.firstAttempt > 15000){
        console.log('[CartCounter] ❌ Failed to post after multiple attempts, dropping.', e);
        state.pending = null;
        return;
      }
      console.log('[CartCounter] ❌ Error posting to bridge, retrying...', e);
      scheduleRetry(Math.min(1200, 200 + pending.attempts * 200));
    }
  }
  function tryAPI(){
    console.log('[CartCounter] 🔍 Trying Ecwid API, Ecwid available:', !!window.Ecwid);
    if (!window.Ecwid) return false;
    try{
      if (window.Ecwid.Cart?.get){
        console.log('[CartCounter] ✅ Using Ecwid.Cart.get');
        window.Ecwid.Cart.get(function(cart){ 
          const c = cart?.productsQuantity ?? cart?.items?.length ?? 0; 
          console.log('[CartCounter] 🛍️ Ecwid.Cart.get returned:', c);
          post(c, true); 
        });
        return true;
      }
    }catch(e){
      console.log('[CartCounter] ❌ Error with Ecwid.Cart.get:', e);
    }
    try{
      if (window.Ecwid.getCart){
        console.log('[CartCounter] ✅ Using Ecwid.getCart');
        window.Ecwid.getCart(function(cart){ 
          const c = cart?.productsQuantity ?? cart?.items?.length ?? 0; 
          console.log('[CartCounter] 🛍️ Ecwid.getCart returned:', c);
          post(c, true); 
        });
        return true;
      }
    }catch(e){
      console.log('[CartCounter] ❌ Error with Ecwid.getCart:', e);
    }
    return false;
  }
  function check(){
    console.log('[CartCounter] 🔎 check() triggered at', new Date().toLocaleTimeString());
    const viaAPI = tryAPI();
    if (!viaAPI){ 
      console.log('[CartCounter] No API available, trying DOM probe');
      const d = domProbe(); 
      if (d!==null) post(d, false); 
      else console.log('[CartCounter] ❌ No count found via DOM');
    }
  }
  let t; function debounced(){ clearTimeout(t); t=setTimeout(check,300); }
  const mo = new MutationObserver(debounced);
  mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true});
  window.addEventListener('load', debounced);
  window.addEventListener('pageshow', debounced);
  function onMsg(event){
    try{ 
      const m = JSON.parse(event.data); 
      if (m.type==='PING'){ 
        console.log('[CartCounter] 🏓 Received PING, running check');
        setTimeout(check,100); 
      } 
      if (m.type==='TAB_ACTIVE'){ 
        console.log('[CartCounter] 🎯 Tab active changed to:', m.value);
        window.__ghCartCounter.active=!!m.value; 
        if(m.value) setTimeout(check,100); 
      } 
    }catch{}
  }
  window.addEventListener('message', onMsg);
  document.addEventListener('message', onMsg);
  if (window.Ecwid?.OnCartChanged){ 
    try{ 
      console.log('[CartCounter] ✅ Registering Ecwid.OnCartChanged listener');
      window.Ecwid.OnCartChanged.add(function(cart){ 
        const c = cart?.productsQuantity ?? cart?.items?.length ?? 0; 
        console.log('[CartCounter] 🔔 OnCartChanged fired with count:', c);
        post(c,true); 
      }); 
    }catch(e){
      console.log('[CartCounter] ❌ Error registering OnCartChanged:', e);
    }
  }
  console.log('[CartCounter] ⏰ Scheduling periodic checks');
  [400,1000,2000,3500,6000,9000].forEach(d=>setTimeout(check,d));
  setInterval(check, 15000);
})();
true;
`;

const createInjectedJS = (tabKey: 'home' | 'search' | 'cart' | 'orders' | 'profile') => `
(function(){
  const TAB_KEY = '${tabKey}';
  let pendingNavTarget = null;
  let pendingNavTimer = null;
  function scheduleNavIntent(target){
    pendingNavTarget = target;
    if (pendingNavTimer) clearTimeout(pendingNavTimer);
    pendingNavTimer = setTimeout(()=>{ pendingNavTarget = null; }, 1600);
  }
  function consumePending(target){
    if (!target) return false;
    if (pendingNavTarget === target){
      pendingNavTarget = null;
      if (pendingNavTimer) clearTimeout(pendingNavTimer);
      pendingNavTimer = null;
      return true;
    }
    return false;
  }
  function maybeNavigate(tab, force){
    if (!tab || tab === TAB_KEY) return;
    if (!force){
      if (!consumePending(tab)) return;
    } else {
      consumePending(tab);
    }
    window.ReactNativeWebView?.postMessage(JSON.stringify({type:'NAVIGATE_TAB', tab}));
  }

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
  
  function checkNav(force){
    try{
      const url = window.location.href;
      
      if(/\\/cart/i.test(url) || /\\/products\\/cart/i.test(url)){
        maybeNavigate('cart', force || pendingNavTarget==='cart');
      }
      else if(/\\/checkout/i.test(url) || url.includes('#checkout')){
        maybeNavigate('cart', force || pendingNavTarget==='cart');
      }
      else if(/\\/account/i.test(url) || /\\/profile/i.test(url)){
        if(/\\/orders/i.test(url)){
          maybeNavigate('orders', force);
        } else {
          maybeNavigate('profile', force);
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
          scheduleNavIntent('cart');
          setTimeout(()=>checkNav(true), 200);
          setTimeout(()=>checkNav(false), 700);
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
          scheduleNavIntent('cart');
          setTimeout(()=>checkNav(true), 250);
        }
        if(/account\\/orders/i.test(action)){
          scheduleNavIntent('orders');
          setTimeout(()=>checkNav(true), 250);
        }
        if(/account/i.test(action) && !/orders/i.test(action)){
          scheduleNavIntent('profile');
          setTimeout(()=>checkNav(true), 250);
        }
      }
    }catch(e){}
  }, true);
  
  document.addEventListener('click', function(e){
    try{
      const el = (e.target && e.target.closest && e.target.closest('a, button, [role=\"button\"]')) || null;
      if(!el) return;
      const href = (el.getAttribute('href') || '').toLowerCase();
      const text = (el.textContent || '').toLowerCase();
      if(/account\\/orders/.test(href) || /orders/i.test(text)){
        scheduleNavIntent('orders');
      } else if(/account/.test(href) || /profile/.test(href) || /account/i.test(text)){
        scheduleNavIntent('profile');
      }
    }catch(e){}
  }, true);
  
  setInterval(()=>checkNav(false), 2000);
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
          console.log(`[WebShell:${tabKey}] 📊 CART COUNT UPDATE - value:`, msg.value, 'count:', msg.count, 'normalized:', normalized, 'calling setCartCount now!');
          setCartCount(normalized);
          console.log(`[WebShell:${tabKey}] ✅ setCartCount called with:`, normalized);
        } else if (msg.type === 'NAVIGATE_TAB') {
          if (msg.tab && msg.tab !== tabKey) {
            console.log(`[WebShell:${tabKey}] 🧭 Navigating to tab:`, msg.tab);
            router.push(`/(tabs)/${msg.tab}` as any);
          }
        } else if (msg.type === 'EMAIL_LINK_SENT') {
          console.log(`[WebShell:${tabKey}] 📧 Email link sent detected`);
        } else if (msg.type === 'DEBUG_TEST') {
          console.log(`[WebShell:${tabKey}] 🔍 DEBUG TEST RECEIVED:`, msg.value, 'at', new Date(msg.timestamp).toLocaleTimeString());
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
      console.log(`[WebShell:${tabKey}] ✅ Load complete, requesting cart count`);
      const pingDelays = tabKey === 'home'
        ? [800, 2000, 3500, 5000, 6500, 8000, 9500, 11000]
        : [500, 2000, 5000];
      pingDelays.forEach((delay, idx) => {
        setTimeout(() => {
          const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
          if (targetRef) {
            console.log(`[WebShell:${tabKey}] 📤 Sending PING after ${delay}ms (load seq #${idx + 1})`);
            targetRef.postMessage(JSON.stringify({ type: 'PING' }));
          }
        }, delay);
      });
    }, [ref, tabKey]);

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
          
          setTimeout(() => {
            console.log(`[WebShell:${tabKey}] 📤 Sending PING for cart check`);
            actualRef.postMessage(JSON.stringify({ type: 'PING' }));
          }, 100);
          if (tabKey === 'home') {
            const extraFocusPings = [700, 1800, 3200, 5200, 7200];
            extraFocusPings.forEach((delay, idx) => {
              setTimeout(() => {
                if (!isMountedRef.current || !isActiveRef.current) return;
                const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
                if (targetRef) {
                  console.log(`[WebShell:${tabKey}] 📤 Sending extra focus PING after ${delay}ms (focus seq #${idx + 2})`);
                  targetRef.postMessage(JSON.stringify({ type: 'PING' }));
                }
              }, delay);
            });
          }
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
            ${CART_COUNTER_SCRIPT}
            ${createInjectedJS(tabKey)}
            
            setTimeout(() => {
              console.log('🔍 WEBVIEW DEBUG - Script injection completed');
              console.log('🔍 Window.ReactNativeWebView available:', !!window.ReactNativeWebView);
              console.log('🔍 Cart script installed:', !!window.__ghCartCounter);
              
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'DEBUG_TEST',
                  value: 'WebView script is running',
                  timestamp: Date.now()
                }));
              }
            }, 2000);
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
