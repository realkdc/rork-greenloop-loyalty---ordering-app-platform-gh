(function(){
  if (window.__ghCC?.installed) return;
  window.__ghCC = { installed: true, active: true, lastSent: undefined, lastCount: 0 };

  const d = document;
  const q  = (sel) => d.querySelector(sel);
  const qAll = (sel) => d.querySelectorAll(sel);

  function parseIntSafe(x){
    if (!x) return null;
    const str = String(x).trim();
    const n = parseInt(str, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function tryEcwidAPI(callback) {
    if (!window.Ecwid) return false;
    
    try {
      if (window.Ecwid.Cart?.calculateTotal) {
        const cart = window.Ecwid.Cart.calculateTotal();
        const count = cart?.productsQuantity ?? cart?.items?.length;
        if (count != null && count >= 0) {
          console.log('[GH Cart] ✅ Ecwid.Cart.calculateTotal:', count);
          callback(count);
          return true;
        }
      }
    } catch(e) {
      console.log('[GH Cart] Ecwid.Cart.calculateTotal error:', e);
    }

    try {
      if (window.Ecwid.getCart) {
        window.Ecwid.getCart(function(cart) {
          const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
          console.log('[GH Cart] ✅ Ecwid.getCart callback:', count);
          callback(count);
        });
        return true;
      }
    } catch(e) {
      console.log('[GH Cart] Ecwid.getCart error:', e);
    }
    
    return false;
  }

  function readCountFromDOM(){
    const selectors = [
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

    for (const sel of selectors) {
      const el = q(sel);
      if (!el) continue;
      
      const dataCount = el.getAttribute('data-count') || el.getAttribute('data-cart-count');
      const text = (el.textContent || '').trim();
      const n = parseIntSafe(dataCount || text);
      
      if (n !== null && n >= 0) {
        console.log('[GH Cart] ✅ Found via DOM selector', sel, '→', n);
        return n;
      }
    }

    const bagText = Array.from(qAll('a,button,li,span,div')).find(e => 
      /shopping bag\s*\((\d+)\)/i.test(e.textContent||'')
    );
    if (bagText) {
      const match = bagText.textContent.match(/\((\d+)\)/);
      const n = parseIntSafe(match?.[1]);
      if (n !== null && n >= 0) {
        console.log('[GH Cart] ✅ Found via "Shopping bag (N)"→', n);
        return n;
      }
    }

    if (/\/cart/i.test(location.pathname)) {
      const items = qAll('.ec-cart__products li, [data-cart-item], .cart__item, .ec-cart-item');
      if (items.length > 0) {
        console.log('[GH Cart] ✅ Cart page items:', items.length);
        return items.length;
      }
    }

    console.log('[GH Cart] ⚠️ No DOM count found');
    return null;
  }

  function postCount(value, force=false){
    if (!window.__ghCC.active && !force) return;
    
    const finalValue = (value === null || value === undefined) ? window.__ghCC.lastCount : value;
    const payload = { type:'CART_COUNT', value: finalValue, source: location.pathname };
    const same = JSON.stringify(payload) === JSON.stringify(window.__ghCC.lastSent);
    
    if (!force && same) return;
    
    window.__ghCC.lastSent = payload;
    window.__ghCC.lastCount = finalValue;
    console.log('[GH Cart] 📤 Posting to RN:', payload);
    
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function checkAndPost() {
    let found = tryEcwidAPI((count) => {
      postCount(count, false);
    });
    
    if (!found) {
      const domCount = readCountFromDOM();
      if (domCount !== null) {
        postCount(domCount, false);
      }
    }
  }

  const debouncedCheck = (()=> {
    let t; 
    return ()=>{ 
      clearTimeout(t); 
      t=setTimeout(checkAndPost, 300); 
    }
  })();

  const mo = new MutationObserver(debouncedCheck);
  mo.observe(d.documentElement, { childList:true, subtree:true, attributes:true });

  ['pageshow','visibilitychange','popstate','hashchange','load','DOMContentLoaded'].forEach(ev => 
    addEventListener(ev, debouncedCheck, {passive:true})
  );

  [100, 500, 1000, 2000, 3000, 5000].forEach(delay => {
    setTimeout(checkAndPost, delay);
  });

  if (window.Ecwid?.OnCartChanged) {
    try {
      window.Ecwid.OnCartChanged.add(function(cart){
        const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
        console.log('[GH Cart] 🔔 Ecwid OnCartChanged event:', count);
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
      checkAndPost();
    }
    if (msg.type === 'PING') { 
      checkAndPost();
    }
  });
})();
