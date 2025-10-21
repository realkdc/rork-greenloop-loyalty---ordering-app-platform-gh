import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';
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
  if (typeof window.__ghMagicLinkCooldown === 'undefined') {
    window.__ghMagicLinkCooldown = 0;
  }

  const GH_SHADOW_ROOTS = [];
  const GH_SHADOW_ROOT_SET = new Set();
  const GH_OBSERVED_TARGETS = new Set();
  let magicObserver = null;
  let requestObserver = null;

  function registerShadowRoot(root){
    if (!root || GH_SHADOW_ROOT_SET.has(root)) return;
    GH_SHADOW_ROOT_SET.add(root);
    GH_SHADOW_ROOTS.push(root);
    discoverShadowRootsFrom(root);
    ensureObservers();
  }

  function discoverShadowRootsFrom(origin){
    if (!origin || typeof origin.querySelectorAll !== 'function') return;
    try {
      const nodes = origin.querySelectorAll('*');
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (el && el.shadowRoot) {
          registerShadowRoot(el.shadowRoot);
        }
      }
    } catch (err) {}
  }

  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function(init){
    const shadow = originalAttachShadow.call(this, init);
    if (!init || init.mode === 'open') {
      registerShadowRoot(shadow);
    }
    return shadow;
  };

  function getSearchRoots(){
    const roots = [document];
    for (let i = 0; i < GH_SHADOW_ROOTS.length; i++) {
      const root = GH_SHADOW_ROOTS[i];
      if (root && typeof root.querySelectorAll === 'function') {
        roots.push(root);
      }
    }
    return roots;
  }

  function querySelectorAllDeep(selector){
    const matches = [];
    const seen = new Set();
    const roots = getSearchRoots();
    for (let r = 0; r < roots.length; r++) {
      const root = roots[r];
      if (!root || typeof root.querySelectorAll !== 'function') continue;
      let nodes;
      try {
        nodes = root.querySelectorAll(selector);
      } catch (err) {
        continue;
      }
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!seen.has(node)) {
          seen.add(node);
          matches.push(node);
        }
      }
    }
    return matches;
  }

  function getCombinedText(){
    let text = '';
    const roots = getSearchRoots();
    for (let r = 0; r < roots.length; r++) {
      const root = roots[r];
      if (!root) continue;
      try {
        if (root === document) {
          const source = document.body || document.documentElement;
          if (source && typeof source.innerText === 'string') {
            text += ' ' + source.innerText;
          }
        } else if ((root.nodeType === 11 || root.nodeType === 9) && typeof root.textContent === 'string') {
          text += ' ' + root.textContent;
        } else if (typeof root.textContent === 'string') {
          text += ' ' + root.textContent;
        }
      } catch (err) {}
    }
    return text;
  }

  function ensureObservers(){
    if (!magicObserver || !requestObserver) return;
    const roots = getSearchRoots();
    for (let r = 0; r < roots.length; r++) {
      const root = roots[r];
      if (!root || GH_OBSERVED_TARGETS.has(root)) continue;
      GH_OBSERVED_TARGETS.add(root);
      try { requestObserver.observe(root, { childList: true, subtree: true }); } catch (err) {}
      try { magicObserver.observe(root, { childList: true, subtree: true, characterData: true }); } catch (err) {}
    }
  }

  const MAGIC_TEXT_REGEX = /(?:the\s*)?link\s+has\s+been\s+sent|check\s+(?:your\s+)?email|check\s+mail|email\s+sent|has\s+been\s+sent\s+to\s+.+@/i;
  const MAGIC_CONFIRM_SELECTORS = [
    '.ec-notification',
    '.ec-notice',
    '.ec-alert',
    '.ec-info-block',
    '.ec-store__notice',
    '.ec-popup__msg',
    '.notification',
    '.alert',
    '.message',
    '.toast',
    '.snackbar',
    '.ins-notification',
    '[role="alert"]',
    '[data-testid="magic-link-confirmation"]'
  ];

  function ensureMagicState(){
    let state = window.__ghMagicLinkState;
    if (!state || typeof state !== 'object'){
      state = {};
    }
    if (typeof state.suppressed === 'undefined') state.suppressed = false;
    if (typeof state.lastVisible === 'undefined') state.lastVisible = false;
    if (typeof state.lastRect === 'undefined') state.lastRect = null;
    if (typeof state.monitorTimer === 'undefined') state.monitorTimer = null;
    if (typeof state.lastRequestTs === 'undefined') state.lastRequestTs = 0;
    window.__ghMagicLinkState = state;
    return state;
  }

  function postDebug(label, data){
    try{
      const payload = { type:'AUTH_DEBUG', scope:'web', tab:TAB_KEY, label, data };
      window.ReactNativeWebView?.postMessage(JSON.stringify(payload));
    }catch(err){
      console.log('[AuthDebug] postDebug error', err);
    }
  }

  postDebug('boot', { location: window.location.href });

  function isElementVisible(el){
    if (!el) return false;
    if (typeof el.getBoundingClientRect !== 'function') return false;
    const rect = el.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 && rect.top >= rect.bottom) return false;
    try{
      const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
      if (style){
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0){
          return false;
        }
      }
    }catch(e){}
    return true;
  }

  function serializeRect(rect){
    if (!rect) return null;
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      height: rect.height,
      width: rect.width
    };
  }

  function findMagicElement(){
    try{
      for (const selector of MAGIC_CONFIRM_SELECTORS){
        const nodes = querySelectorAllDeep(selector);
        for (const node of nodes){
          if (!node) continue;
          const text = (node.innerText || '').trim();
          if (!text || text.length > 400) continue;
          if (MAGIC_TEXT_REGEX.test(text)) return node;
        }
      }

      const roots = getSearchRoots();
      for (let r = 0; r < roots.length; r++){
        const root = roots[r];
        if (!root || typeof root.querySelectorAll !== 'function') continue;
        let candidates;
        try {
          candidates = root.querySelectorAll('div,section,article,form,main,aside,p');
        } catch (err) {
          continue;
        }
        for (let i = 0; i < candidates.length; i++) {
          const node = candidates[i];
          if (!node) continue;
          const text = (node.innerText || '').trim();
          if (!text || text.length > 400) continue;
          if (MAGIC_TEXT_REGEX.test(text)) return node;
        }
      }
    }catch(e){}
    return null;
  }

  function emitMagicVisibility(force){
    const state = ensureMagicState();
    if (state.suppressed) {
      if (state.lastVisible || force) {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type:'MAGIC_CONFIRMATION_VISIBILITY',
          visible:false
        }));
      }
      state.lastVisible = false;
      state.lastRect = null;
      return false;
    }
    const element = findMagicElement();
    const visible = !!element && isElementVisible(element);
    if (visible){
      const rect = serializeRect(element.getBoundingClientRect());
      const previousRect = state.lastRect;
      state.lastRect = rect;
      if (force || !state.lastVisible){
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type:'MAGIC_CONFIRMATION_VISIBILITY',
          visible:true,
          rect
        }));
      } else if (state.lastVisible && rect && previousRect){
        const delta = Math.abs((rect.top ?? 0) - (previousRect.top ?? 0));
        if (delta > 2){
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type:'MAGIC_CONFIRMATION_VISIBILITY',
            visible:true,
            rect
          }));
        }
      }
    } else if (state.lastVisible || force){
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type:'MAGIC_CONFIRMATION_VISIBILITY',
        visible:false
      }));
    }
    if (!visible){
      state.lastRect = null;
    }
    state.lastVisible = visible;
    return visible;
  }

  function monitorMagicConfirmation(){
    const state = ensureMagicState();
    if (state.monitorTimer){
      try{ clearTimeout(state.monitorTimer); }catch(e){}
      state.monitorTimer = null;
    }
    let attempt = 0;
    function tick(){
      const visible = emitMagicVisibility(attempt === 0);
      if (state.suppressed) {
        state.monitorTimer = null;
        return;
      }
      attempt += 1;
      if (!visible && attempt > 12){
        state.monitorTimer = null;
        return;
      }
      state.monitorTimer = setTimeout(tick, visible ? 500 : 900);
    }
    tick();
  }

  const MAGIC_REQUEST_KEYWORDS = /get\s*sign-?in\s*link|send\s*sign-?in\s*link|magic\s*link|email\s*link|check\s*mail|sign\s*in\s*link/i;

  function notifyMagicRequest(source){
    const state = ensureMagicState();
    const now = Date.now();
    const isFormSubmit = typeof source === 'string' && source.indexOf('submit') !== -1;
    const cooldown = isFormSubmit ? 150 : 700;
    if (now - (state.lastRequestTs || 0) < cooldown){
      console.log('[Auth] Magic link request ignored (cooldown) from', source);
      postDebug('request_ignored', { source, now, last: state.lastRequestTs });
      return;
    }
    state.lastRequestTs = now;
    console.log('[Auth] Magic link request detected from', source);
    postDebug('request', { source, now });
    try{
      window.ReactNativeWebView?.postMessage(JSON.stringify({type:'MAGIC_LINK_REQUESTED', source, timestamp: now}));
    }catch(err){
      console.log('[Auth] Error posting MAGIC_LINK_REQUESTED', err);
      postDebug('request_post_error', { source, error: String(err) });
    }
    try{
      if (typeof window.__ghStartMagicProbe === 'function'){
        setTimeout(function(){
          try{
            window.__ghStartMagicProbe(source);
          }catch(probeErr){
            console.log('[Auth] Probe invocation error', probeErr);
            postDebug('probe_invocation_error', { source, error: String(probeErr) });
          }
        }, 80);
      }
    }catch(err){
      console.log('[Auth] Probe dispatch error', err);
      postDebug('probe_dispatch_error', { source, error: String(err) });
    }
  }

  // New: Detect "Get sign-in link" button clicks
  function notifyGetLinkClick(source){
    const state = ensureMagicState();
    const now = Date.now();
    if (now - (state.lastRequestTs || 0) < 700){
      console.log('[Auth] Get link click ignored (cooldown) from', source);
      return;
    }
    state.lastRequestTs = now;
    console.log('[Auth] Get sign-in link button clicked from', source);
    try{
      window.ReactNativeWebView?.postMessage(JSON.stringify({type:'gh:getlink_clicked', source, timestamp: now}));
    }catch(err){
      console.log('[Auth] Error posting gh:getlink_clicked', err);
    }
  }

  const MAGIC_ENDPOINT_PATTERNS = [
    'send-login-link',
    'magic-link',
    'sign-in-link',
    'signin-link',
    'email-login',
    'login/email',
    'account/login'
  ];

  function looksLikeMagicEndpoint(url, body){
    if (!url) return false;
    const lowerUrl = String(url).toLowerCase();
    for (let i = 0; i < MAGIC_ENDPOINT_PATTERNS.length; i++){
      if (lowerUrl.indexOf(MAGIC_ENDPOINT_PATTERNS[i]) !== -1){
        return true;
      }
    }
    if (body && typeof body === 'string'){
      const lowerBody = body.toLowerCase();
      for (let i = 0; i < MAGIC_ENDPOINT_PATTERNS.length; i++){
        if (lowerBody.indexOf(MAGIC_ENDPOINT_PATTERNS[i]) !== -1){
          return true;
        }
      }
    }
    return false;
  }

  function normalizeFetchInput(input){
    if (!input) return { url: '', method: 'GET' };
    if (typeof input === 'string'){
      return { url: input, method: 'GET' };
    }
    try{
      const req = input;
      const url = typeof req.url === 'string' ? req.url : '';
      const method = typeof req.method === 'string' ? req.method : 'GET';
      return { url, method };
    }catch(_){
      return { url: '', method: 'GET' };
    }
  }

  const MAGIC_MESSAGE_ORIGINS = [
    'https://app.ecwid.com',
    'https://my.ecwid.com',
    'https://storefront.ecwid.com',
    window.location.origin
  ];
  let magicMessageLogCount = 0;

  window.addEventListener('message', function(event){
    try {
      const origin = event.origin || '';
      if (!origin) return;
      let matchesOrigin = false;
      for (let i = 0; i < MAGIC_MESSAGE_ORIGINS.length; i++) {
        const candidate = MAGIC_MESSAGE_ORIGINS[i];
        if (candidate && origin.indexOf(candidate) !== -1) {
          matchesOrigin = true;
          break;
        }
      }
      if (!matchesOrigin) return;

      let payloadString = '';
      const payload = event.data;
      if (typeof payload === 'string') {
        payloadString = payload;
      } else if (payload && typeof payload === 'object') {
        try {
          payloadString = JSON.stringify(payload);
        } catch(_) {}
      }

      if (!payloadString) return;
      const normalized = payloadString.toLowerCase();
      const looksLikeMagic = /magic/.test(normalized) || (normalized.includes('sign-in') && normalized.includes('link'));
      if (!looksLikeMagic) return;

      if (magicMessageLogCount < 4) {
        magicMessageLogCount += 1;
        postDebug('iframe_message', { origin, snippet: payloadString.slice(0, 160) });
      }

      notifyMagicRequest('postMessage');

      if (/sent/.test(normalized) || /delivered/.test(normalized) || normalized.includes('email_sent')) {
        triggerMagicLinkBanner('postMessage');
      }
    } catch(err) {
      postDebug('iframe_message_error', { error: String(err) });
    }
  }, false);

  try{
    if (typeof window.fetch === 'function'){
      const originalFetch = window.fetch;
      window.fetch = function(input, init){
        const { url, method } = normalizeFetchInput(input);
        const body = init && typeof init.body === 'string' ? init.body : undefined;
        const looksMagic = looksLikeMagicEndpoint(url, body);
        if (looksMagic){
          postDebug('fetch_hook_request', { url, method, bodySnippet: body ? body.slice(0, 120) : null });
          notifyMagicRequest('fetch:' + method);
        }
        return originalFetch.apply(this, arguments).then(function(response){
          try{
            if (looksMagic && response && typeof response.status === 'number'){
              postDebug('fetch_hook_response', { url, status: response.status, ok: response.ok });
              if (response.ok){
                triggerMagicLinkBanner('fetch');
              }
            }
          }catch(err){
            postDebug('fetch_hook_error', { url, error: String(err) });
          }
          return response;
        }).catch(function(err){
          if (looksMagic){
            postDebug('fetch_hook_reject', { url, error: String(err) });
          }
          throw err;
        });
      };
    }
  }catch(err){
    postDebug('fetch_hook_install_error', { error: String(err) });
  }

  try{
    const XHR = window.XMLHttpRequest;
    if (XHR && XHR.prototype){
      const originalOpen = XHR.prototype.open;
      const originalSend = XHR.prototype.send;

      XHR.prototype.open = function(method, url){
        try {
          this.__ghMagicURL = url;
          this.__ghMagicMethod = method;
        } catch(_err) {}
        return originalOpen.apply(this, arguments);
      };

      XHR.prototype.send = function(body){
        const url = this.__ghMagicURL || '';
        const method = this.__ghMagicMethod || 'GET';
        const looksMagic = looksLikeMagicEndpoint(url, typeof body === 'string' ? body : undefined);
        if (looksMagic && !this.__ghMagicHooked){
          this.__ghMagicHooked = true;
          postDebug('xhr_hook_request', { url, method });
          notifyMagicRequest('xhr:' + method);
          this.addEventListener('readystatechange', function(){
            if (this.readyState === 4){
              postDebug('xhr_hook_response', { url, status: this.status });
              if (this.status >= 200 && this.status < 300){
                triggerMagicLinkBanner('xhr');
              }
            }
          });
        }
        return originalSend.apply(this, arguments);
      };
    }
  }catch(err){
    postDebug('xhr_hook_install_error', { error: String(err) });
  }

  function textFromElement(el){
    if (!el) return '';
    const parts = [];
    const attrs = ['data-label','data-testid','data-test','aria-label','title','name','id'];
    for (let i = 0; i < attrs.length; i++){
      const val = el.getAttribute && el.getAttribute(attrs[i]);
      if (val) parts.push(val);
    }
    if (typeof el.value === 'string') parts.push(el.value);
    if (typeof el.innerText === 'string') parts.push(el.innerText);
    if (typeof el.textContent === 'string') parts.push(el.textContent);
    return parts.join(' ').toLowerCase();
  }

  function scanForMagicControls(){
    try{
      const controlSelectors = ['button','a','input[type="submit"]','input[type="button"]','[role="button"]'];
      controlSelectors.forEach(function(sel){
        const nodes = querySelectorAllDeep(sel);
        for (let i = 0; i < nodes.length; i++){
          const node = nodes[i];
          if (!node || node.__ghMagicHooked) continue;
          const label = textFromElement(node);
          if (!label) continue;
          if (MAGIC_REQUEST_KEYWORDS.test(label)){
            node.__ghMagicHooked = true;
            console.log('[Auth] Hooked magic request control', sel, label);
            postDebug('hook_control', { selector: sel, label, tag: node.tagName });
            ['click','tap','touchend','pointerup','mouseup'].forEach(function(evt){
              try{
                node.addEventListener(evt, function(){
                  notifyMagicRequest('control:'+evt);
                }, { passive: true });
              }catch(e){}
            });
          }
        }
      });
      const forms = querySelectorAllDeep('form');
      for (let i = 0; i < forms.length; i++){
        const form = forms[i];
        if (!form || form.__ghMagicHooked) continue;
        const formLabel = textFromElement(form);
        if (formLabel && MAGIC_REQUEST_KEYWORDS.test(formLabel)){
          form.__ghMagicHooked = true;
          console.log('[Auth] Hooked magic request form');
          postDebug('hook_form', { action: form.action, label: formLabel });
          try{
            form.addEventListener('submit', function(){
              notifyMagicRequest('hooked-form');
            }, { passive: true });
          }catch(e){}
        }
      }
    }catch(err){
      console.log('[Auth] scanForMagicControls error', err);
    }
  }

  // New: Scan for "Get sign-in link" buttons specifically
  function scanForGetLinkButtons(){
    try{
      const getLinkSelectors = [
        'button[type="submit"]',
        '#send-login-link',
        'button:contains("Sign-In Link")',
        'button:contains("Send Link")',
        'button:contains("Email me a login link")',
        'a:contains("Get sign-in link")',
        'button:contains("Get sign-in link")',
        '[data-testid*="sign-in-link"]',
        '[data-testid*="send-link"]'
      ];
      
      // Also check for text content matches
      const getLinkKeywords = /get\s*sign-?in\s*link|send\s*sign-?in\s*link|email\s*me\s*a\s*login\s*link|sign-?in\s*link/i;
      
      const allButtons = querySelectorAllDeep('button, a, input[type="submit"], [role="button"]');
      for (let i = 0; i < allButtons.length; i++){
        const button = allButtons[i];
        if (!button || button.__ghGetLinkHooked) continue;
        
        const text = textFromElement(button);
        const id = button.getAttribute('id') || '';
        const testId = button.getAttribute('data-testid') || '';
        
        if (getLinkKeywords.test(text) || 
            id.includes('send-login-link') || 
            testId.includes('sign-in-link') || 
            testId.includes('send-link')) {
          
          button.__ghGetLinkHooked = true;
          console.log('[Auth] Hooked Get sign-in link button:', text, id, testId);
          
          ['click','tap','touchend','pointerup','mouseup'].forEach(function(evt){
            try{
              button.addEventListener(evt, function(){
                notifyGetLinkClick('getlink-button:'+evt);
              }, { passive: true });
            }catch(e){}
          });
        }
      }
    }catch(err){
      console.log('[Auth] scanForGetLinkButtons error', err);
    }
  }

  requestObserver = new MutationObserver(function(){
    scanForMagicControls();
    scanForGetLinkButtons();
  });

  function startRequestWatcher(){
    const target = document.body;
    if (target){
      registerShadowRoot(target);
    }
    scanForMagicControls();
    scanForGetLinkButtons();
    ensureObservers();
    setTimeout(() => {
      scanForMagicControls();
      scanForGetLinkButtons();
    }, 1000);
  }

  let lastMagicText = '';

  function triggerMagicLinkBanner(source){
    if (ensureMagicState().suppressed){
      console.log('[Auth] Magic link banner suppressed - skipping (' + source + ')');
      return;
    }
    const now = Date.now();
    if (now - window.__ghMagicLinkCooldown < 3000) return;
    window.__ghMagicLinkCooldown = now;
    console.log('[Auth] Email confirmation detected (' + source + ')');
    monitorMagicConfirmation();
    setTimeout(() => {
      const state = ensureMagicState();
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type:'EMAIL_LINK_SENT',
        confirmationVisible: !!state.lastVisible,
        confirmationRect: state.lastRect
      }));
    }, 600);
  }

  function scanForMagic(source){
    try {
      const bodyText = getCombinedText();
      if (bodyText === lastMagicText) return;
      lastMagicText = bodyText;
      if (MAGIC_TEXT_REGEX.test(bodyText)) {
        triggerMagicLinkBanner(source);
      }
    } catch(_) {}
  }

  magicObserver = new MutationObserver(function(){
    scanForMagic('observer');
  });

  function startMagicWatcher(){
    const target = document.body;
    if (!target) {
      return;
    }
    registerShadowRoot(target);
    ensureObservers();
    scanForMagic('initial');
  }

  function onReady(){
    startMagicWatcher();
    startRequestWatcher();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }

  let pendingNavTarget = null;
  let pendingNavTimer = null;
  function scheduleNavIntent(target){
    pendingNavTarget = target;
    if (pendingNavTimer) clearTimeout(pendingNavTimer);
    pendingNavTimer = setTimeout(function(){ pendingNavTarget = null; }, 1600);
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

        if(
          /get\s*sign-?in\s*link|send\s*sign-?in\s*link|open\s*sign-?in\s*link/i.test(text) ||
          /sign-?in-?link|magic-?link/i.test(href) ||
          /sign-?in|magic-?link/i.test(onclick)
        ){
          notifyMagicRequest('captured-click');
        }
        
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
        const formText = (form.textContent || '').toLowerCase();
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
        if(
          /sign-?in|magic/i.test(action) ||
          /get\\s*sign-?in\\s*link|send\\s*sign-?in\\s*link|magic\\s*link/i.test(formText)
        ){
          notifyMagicRequest('submit-handler');
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
          if (!isActiveRef.current) {
            console.log(`[WebShell:${tabKey}] ⏭️ Ignoring CART_COUNT while tab inactive`);
            return;
          }
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
      setIsLoading(false);
    }, []);

    const handleLoadStart = useCallback(() => {
      setIsLoading(true);
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
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled={Platform.OS === 'android'}
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
