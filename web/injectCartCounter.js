(function(){
  if (window.__ghCC?.installed) return;
  window.__ghCC = { installed: true, active: false, lastSent: undefined, timer: null };

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
      const bag = Array.from(qAll('a,button,li')).find(e => /shopping bag\s*\(\d+\)/i.test(e.textContent||''));
      if (bag) n = parseIntSafe((bag.textContent.match(/\((\d+)\)/)||[])[1]);
    }

    if (n === null && /\/products\/cart/i.test(location.pathname)) {
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
      postCount(n, true); 
    }
    if (msg.type === 'PING') { 
      const n = readCount();
      postCount(n, true); 
    }
  });
})();
