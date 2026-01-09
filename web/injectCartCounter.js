(function(){
  if (window.__ghCartCounter?.installed) {
    console.log('[CartCounter] ⏭️ Already installed');
    return;
  }

  function readPersisted(){
    try {
      const raw = sessionStorage.getItem('__ghLastCount') || '';
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  const state = {
    installed: true,
    active: true,
    ready: false,
    confirmedEmpty: false,
    lastCount: readPersisted(),
    lastSent: null,
  };

  window.__ghCartCounter = state;
  window.__ghCC = state;

  const doc = document;
  const $ = (selector) => doc.querySelector(selector);
  const $$ = (selector) => doc.querySelectorAll(selector);

  function isCartPage(){
    return /\/cart(\b|\/|$)/i.test(location.pathname) || /#checkout/i.test(location.hash);
  }

  function parseCount(value){
    if (value === null || value === undefined) return null;
    const num = parseInt(String(value).trim(), 10);
    return Number.isFinite(num) && num >= 0 ? num : null;
  }

  function persist(value){
    try { sessionStorage.setItem('__ghLastCount', String(value)); } catch {}
  }

  function postCount(value, fromAPI, force){
    if (!state.active && !force) {
      console.log('[CartCounter] ⏸️ Inactive tab, skipping post');
      return;
    }

    let next = value;
    if (next === null || next === undefined) {
      if (!state.ready) {
        console.log('[CartCounter] ⏭️ Ignoring undefined value before ready');
        return;
      }
      next = state.lastCount;
    }

    if (!Number.isFinite(next) || next < 0) {
      next = 0;
    }

    if (next === 0 && state.lastCount > 0 && isCartPage() && !state.confirmedEmpty && !force) {
      console.log('[CartCounter] ⏭️ Skipping downgrade to 0 on cart page (previous > 0)');
      return;
    }

    if (fromAPI) {
      state.ready = true;
      state.confirmedEmpty = next === 0;
    } else if (next > 0) {
      state.ready = true;
      state.confirmedEmpty = false;
    }

    const payload = { type: 'CART_COUNT', value: next, source: location.pathname };
    if (!force && state.lastSent && state.lastSent.value === payload.value) {
      return;
    }

    state.lastSent = payload;
    state.lastCount = next;
    persist(next);

    if (!window.ReactNativeWebView) {
      console.log('[CartCounter] ⚠️ Bridge not ready, retrying in 300ms');
      setTimeout(() => postCount(next, fromAPI, true), 300);
      return;
    }

    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      console.log('[CartCounter] 📤 Posting to RN:', payload);
    } catch (err) {
      console.log('[CartCounter] ❌ Failed posting to RN:', err);
      setTimeout(() => postCount(next, fromAPI, true), 500);
    }
  }

  function tryEcwidAPI(callback){
    if (!window.Ecwid) return false;

    try {
      if (window.Ecwid.Cart?.get) {
        window.Ecwid.Cart.get((cart) => {
          const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
          console.log('[CartCounter] ✅ Ecwid.Cart.get:', count);
          callback(count, true);
        });
        return true;
      }
    } catch (err) {
      console.log('[CartCounter] Ecwid.Cart.get error:', err);
    }

    try {
      if (window.Ecwid.Cart?.calculateTotal) {
        const cart = window.Ecwid.Cart.calculateTotal();
        const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
        if (count >= 0) {
          console.log('[CartCounter] ✅ Ecwid.Cart.calculateTotal:', count);
          callback(count, true);
          return true;
        }
      }
    } catch (err) {
      console.log('[CartCounter] Ecwid.Cart.calculateTotal error:', err);
    }

    try {
      if (window.Ecwid.getCart) {
        window.Ecwid.getCart((cart) => {
          const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
          console.log('[CartCounter] ✅ Ecwid.getCart:', count);
          callback(count, true);
        });
        return true;
      }
    } catch (err) {
      console.log('[CartCounter] Ecwid.getCart error:', err);
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

    for (let i = 0; i < selectors.length; i += 1) {
      const target = $(selectors[i]);
      if (!target) continue;
      const raw = target.getAttribute('data-count') || target.getAttribute('data-cart-count') || (target.textContent || '').trim();
      const parsed = parseCount(raw);
      if (parsed !== null) {
        console.log('[CartCounter] ✅ DOM selector', selectors[i], '→', parsed);
        return parsed;
      }
    }

    const bag = Array.from($$('a,button,li,span,div')).find((node) => /shopping bag\s*\((\d+)\)/i.test(node.textContent || ''));
    if (bag) {
      const match = (bag.textContent || '').match(/\((\d+)\)/);
      const count = parseCount(match && match[1]);
      if (count !== null) {
        console.log('[CartCounter] ✅ Found "Shopping Bag (N)" →', count);
        return count;
      }
    }

    if (isCartPage()) {
      const items = $$('.ec-cart__products li, [data-cart-item], .cart__item, .ec-cart-item');
      if (items.length > 0) {
        console.log('[CartCounter] ✅ Cart page items:', items.length);
        return items.length;
      }
    }

    console.log('[CartCounter] ❌ No DOM count found');
    return null;
  }

  function checkAndPost(force){
    const handled = tryEcwidAPI((count) => postCount(count, true, force));
    if (handled) return;

    const domCount = readCountFromDOM();
    if (domCount !== null) {
      postCount(domCount, false, force);
    } else if (force) {
      postCount(state.lastCount || 0, false, true);
    }
  }

  const debouncedCheck = (() => {
    let timer = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => checkAndPost(false), 300);
    };
  })();

  const observer = new MutationObserver(debouncedCheck);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });

  ['pageshow','visibilitychange','popstate','hashchange','load','DOMContentLoaded'].forEach((evt) => {
    addEventListener(evt, debouncedCheck, { passive: true });
  });

  [300, 800, 1500, 3000, 5000, 8000].forEach((delay) => setTimeout(() => checkAndPost(true), delay));

  if (window.Ecwid?.OnCartChanged) {
    try {
      window.Ecwid.OnCartChanged.add((cart) => {
        const count = cart?.productsQuantity ?? cart?.items?.length ?? 0;
        console.log('[CartCounter] 🔔 Ecwid OnCartChanged:', count);
        postCount(count, true, true);
      });
    } catch (err) {
      console.log('[CartCounter] OnCartChanged error:', err);
    }
  }

  function handleBridgeMessage(event){
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'TAB_ACTIVE') {
        state.active = !!data.value;
        console.log('[CartCounter] 🎯 Tab active →', state.active);
        if (state.active) {
          setTimeout(() => checkAndPost(true), 80);
        }
      }
      if (data.type === 'PING') {
        console.log('[CartCounter] 🏓 PING received');
        setTimeout(() => checkAndPost(true), 80);
      }
    } catch (err) {
      console.log('[CartCounter] Message parse error:', err);
    }
  }

  window.addEventListener('message', handleBridgeMessage);
  document.addEventListener('message', handleBridgeMessage);
})();
