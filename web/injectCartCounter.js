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
      const attr = el.getAttribute('data-count');
      n = parseIntSafe(attr);
      console.log('[GH Cart] Header badge data-count:', attr, '→', n);
    }

    if (n === null) {
      const bag = Array.from(qAll('a,button,li')).find(e => /shopping bag\s*\(\d+\)/i.test(e.textContent||''));
      if (bag) {
        const match = bag.textContent.match(/\((\d+)\)/);
        n = parseIntSafe(match ? match[1] : null);
        console.log('[GH Cart] Footer bag text:', bag.textContent, '→', n);
      }
    }

    if (n === null && /\/products\/cart/i.test(location.pathname)) {
      const items = qAll('.ec-cart__products li, [data-cart-item], .cart__item');
      n = items.length > 0 ? items.length : 0;
      console.log('[GH Cart] Cart page items:', items.length, '→', n);
    }

    if (n === null) {
      const w = q('.ec-cart-widget__counter, .cart-counter, [data-cart-count]');
      if (w) {
        n = parseIntSafe(w.getAttribute('data-cart-count') || w.textContent);
        console.log('[GH Cart] Widget counter:', w, '→', n);
      }
    }

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
