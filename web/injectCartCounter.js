(function(){
  if (window.__ghCC?.installed) return;
  const persisted = (()=>{
    try{ return parseInt(sessionStorage.getItem('__ghLastCount')||''); }catch{ return NaN; }
  })();
  window.__ghCC = { installed: true, active: true, lastSent: undefined, lastCount: Number.isFinite(persisted)&&persisted>0?persisted:0, ready:false, confirmedEmpty:false };

  const d = document;
  const q  = (sel) => d.querySelector(sel);
  const qAll = (sel) => d.querySelectorAll(sel);

  function isCartPage(){ return /\/cart(\b|\/|$)/i.test(location.pathname) || /#checkout/i.test(location.hash); }

  function parseIntSafe(x){
    if (!x) return null;
    const str = String(x).trim();
    const n = parseInt(str, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function tryEcwidAPI(callback) {
    if (!window.Ecwid) return false;
    let handled = false;

    try {
      if (window.Ecwid.Cart?.get) {
        window.Ecwid.Cart.get(function(cart){
          const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
          console.log('[GH Cart] ✅ Ecwid.Cart.get:', count);
          callback(count, true);
        });
        handled = true;
      }
    } catch(e) {
      console.log('[GH Cart] Ecwid.Cart.get error:', e);
    }

    if (handled) return true;

    try {
      if (window.Ecwid.Cart?.calculateTotal) {
        const cart = window.Ecwid.Cart.calculateTotal();
        const count = cart?.productsQuantity ?? cart?.items?.length;
        if (count != null && count >= 0) {
          console.log('[GH Cart] ✅ Ecwid.Cart.calculateTotal:', count);
          callback(count, true);
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
          callback(count, true);
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

    if (isCartPage()) {
      const items = qAll('.ec-cart__products li, [data-cart-item], .cart__item, .ec-cart-item');
      if (items.length > 0) {
        console.log('[GH Cart] ✅ Cart page items:', items.length);
        return items.length;
      }
    }

    console.log('[GH Cart] ⚠️ No DOM count found');
    return null;
  }

  function persist(n){ try{ sessionStorage.setItem('__ghLastCount', String(n)); }catch{}
  }

  function postCount(value, fromAPI=false, force=false){
    if (!window.__ghCC.active && !force) return;
    if (value === null || value === undefined) {
      if (!window.__ghCC.ready) return;
    }
    const next = (value === null || value === undefined) ? window.__ghCC.lastCount : value;
    if (next === 0 && window.__ghCC.lastCount > 0 && isCartPage() && !window.__ghCC.confirmedEmpty && !force) {
      console.log('[GH Cart] ⏭️ Skipping downgrade to 0 on cart page');
      return;
    }
    if (fromAPI) {
      window.__ghCC.ready = true;
      window.__ghCC.confirmedEmpty = next === 0 ? true : false;
    }
    if (next > 0) {
      window.__ghCC.ready = true;
      window.__ghCC.confirmedEmpty = false;
    }

    const payload = { type:'CART_COUNT', value: next, source: location.pathname };
    const same = JSON.stringify(payload) === JSON.stringify(window.__ghCC.lastSent);
    if (!force && same) return;

    window.__ghCC.lastSent = payload;
    window.__ghCC.lastCount = next;
    persist(next);
    console.log('[GH Cart] 📤 Posting to RN:', payload);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function checkAndPost() {
    let found = tryEcwidAPI((count, api)=>{
      postCount(count, true, false);
    });
    if (!found) {
      const domCount = readCountFromDOM();
      if (domCount !== null) {
        postCount(domCount, false, false);
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

  [300, 800, 1500, 3000, 5000, 8000].forEach(delay => {
    setTimeout(checkAndPost, delay);
  });

  if (window.Ecwid?.OnCartChanged) {
    try {
      window.Ecwid.OnCartChanged.add(function(cart){
        const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
        console.log('[GH Cart] 🔔 Ecwid OnCartChanged event:', count);
        postCount(count, true, true);
      });
    } catch(e) {
      console.log('[GH Cart] OnCartChanged.add error:', e);
    }
  }

  addEventListener('message', (e)=>{
    let msg;
    try { msg = JSON.parse(String(e.data||'{}')); } catch { return; }
    if (msg.type === 'TAB_ACTIVE') { window.__ghCC.active = !!msg.value; checkAndPost(); }
    if (msg.type === 'PING') { checkAndPost(); }
  });
})();
