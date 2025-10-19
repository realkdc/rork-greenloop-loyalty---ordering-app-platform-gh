export const INJECTED_CSS = `
/* Hide global header/nav and footer to feel native */
.ins-header, .ec-breadcrumbs, .footer__icons, .ec-footer__icons,
.ec-store .footer__icons, .ec-footer, .site-footer__icons,
.a--crumbs, .ec-breadcrumbs__item, .links-menu, .ec-footer__links,
[aria-label="Breadcrumbs"], .ec-footer__inner .ec-footer__nav,
header, .site-header, .header, .main-header,
footer, .site-footer, .footer, .main-footer,
.breadcrumbs, .Breadcrumbs, nav.breadcrumbs, .Page-breadcrumbs,
.prefooter, .pre-footer, .footer-links, .footer__links,
.links-grid, .quick-links, .menu-grid, .app-links,
.drawer-menu, .sticky-bar, .footer-spacer, .footer__spacer { 
  display: none !important; 
}

/* Kill any spacer/gap */
body, html, main, #page { 
  padding: 0 !important; 
  margin: 0 !important; 
}
#wrapper, #content, .page-content, .ec-size { 
  padding-bottom: 0 !important; 
}

/* Prevent overscroll white flash */
html, body { 
  overscroll-behavior: none; 
  background: #fff; 
}

#shopify-section-footer, .footer-wrapper, .Footer, .SiteFooter { 
  display: none !important; 
  height: 0 !important; 
}

.sticky, .is-sticky, [data-sticky] { 
  position: static !important; 
  top: auto !important; 
}

.breadcrumbs a, .Breadcrumbs a { 
  pointer-events: none !important; 
}

.hero, .Hero, .banner, .Banner { 
  margin-top: 0 !important; 
}

button, .btn, .Button, a.Button, .buy-now { 
  border-radius: 12px !important; 
}
`;

export const INJECTED_JS = `
(function(){
  function addStyle(css){
    var el = document.createElement('style'); 
    el.type='text/css'; 
    el.appendChild(document.createTextNode(css)); 
    if (document.head) {
      document.head.appendChild(el);
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        document.head.appendChild(el);
      });
    }
  }

  const HIDE_CSS = \`
    .ins-header, .ec-breadcrumbs, .footer__icons, .ec-footer__icons,
    .ec-store .footer__icons, .ec-footer, .site-footer__icons,
    .a--crumbs, .ec-breadcrumbs__item, .links-menu, .ec-footer__links,
    [aria-label="Breadcrumbs"], .ec-footer__inner .ec-footer__nav,
    header, .site-header, .header, .main-header,
    footer, .site-footer, .footer, .main-footer { 
      display: none !important; 
    }
    body, main { 
      padding-bottom: 0 !important; 
      margin-bottom: 0 !important; 
    }
  \`;
  
  addStyle(HIDE_CSS);

  function hideAgain() {
    try {
      const hideSelectors = [
        '.ins-header', '.ec-breadcrumbs', '.footer__icons', '.ec-footer', 
        '[aria-label="Breadcrumbs"]', 'header', '.site-header', 
        'footer', '.site-footer', '.breadcrumbs', '.Breadcrumbs'
      ];
      
      hideSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(n => {
          if (n && n.style) {
            n.style.display = 'none';
          }
        });
      });

      if (document.body) {
        document.body.style.paddingBottom = '0px';
        document.body.style.marginBottom = '0px';
      }
    } catch(e) {
      console.log('Hide error:', e);
    }
  }

  try {
    new MutationObserver(hideAgain).observe(document.documentElement, {
      childList: true, 
      subtree: true
    });
  } catch(e) {}

  hideAgain();

  try {
    document.querySelectorAll(
      '.ec-footer, .ec-footer__row, .ec-footer__cells, .ec-footer__links'
    ).forEach(node => {
      const txt = (node.textContent || '').toLowerCase();
      const isLegalFooter = txt.includes('legal') && txt.includes('long-lasting');
      if (!isLegalFooter && (
          txt.includes('search products') || txt.includes('shopping bag') ||
          txt.includes('gift cards') || txt.includes('track orders') ||
          txt.includes('favorites') || txt.includes('my account')
      )) {
        node.remove();
      }
    });

    document.querySelectorAll(
      'a.footer__link, a.ec-footer__link, a.ec-link--icon-top, a[class*="footer__link"]'
    ).forEach(a => {
      const row = a.closest('ul, .ec-footer__row, .ec-footer__links, .ec-footer, section, div');
      if (row) row.remove();
    });
  } catch(e) {}

  const post = (d) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(d));

  const MAGIC_TEXT_REGEX = /(?:the\s*)?link\s+has\s+been\s+sent|check\s+(?:your\s+)?email|check\s+mail|email\s+sent|has\s+been\s+sent\s+to\s+.+@|magic\s+link\s+sent/i;
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
  let lastMagicText = '';

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
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes){
          if (!node) continue;
          const text = (node.innerText || '').trim();
          if (!text || text.length > 400) continue;
          if (MAGIC_TEXT_REGEX.test(text)) return node;
        }
      }
      const candidates = document.body ? document.body.querySelectorAll('div,section,article,form,main,aside,p') : [];
      for (const node of candidates){
        if (!node) continue;
        const text = (node.innerText || '').trim();
        if (!text || text.length > 400) continue;
        if (MAGIC_TEXT_REGEX.test(text)) return node;
      }
    }catch(e){}
    return null;
  }

  function emitMagicVisibility(force){
    const state = ensureMagicState();
    if (state.suppressed) {
      if (state.lastVisible || force) {
        post({ type:'MAGIC_CONFIRMATION_VISIBILITY', visible:false });
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
        post({ type:'MAGIC_CONFIRMATION_VISIBILITY', visible:true, rect });
      } else if (state.lastVisible && rect && previousRect){
        const delta = Math.abs((rect.top ?? 0) - (previousRect.top ?? 0));
        if (delta > 2){
          post({ type:'MAGIC_CONFIRMATION_VISIBILITY', visible:true, rect });
        }
      }
    } else if (state.lastVisible || force){
      post({ type:'MAGIC_CONFIRMATION_VISIBILITY', visible:false });
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

  if (typeof window.__ghMagicLinkCooldown === 'undefined') {
    window.__ghMagicLinkCooldown = 0;
  }
  function handleMagicLinkDetected(source) {
    const state = ensureMagicState();
    if (state.suppressed) {
      console.log('[Auth] Magic link detection suppressed - skipping (' + source + ')');
      return;
    }
    const now = Date.now();
    if (now - window.__ghMagicLinkCooldown < 3000) {
      return;
    }
    window.__ghMagicLinkCooldown = now;
    console.log('[Auth] Magic link email detected (' + source + ')');
    monitorMagicConfirmation();
    setTimeout(() => {
      const nextState = ensureMagicState();
      post({ 
        type: 'EMAIL_LINK_SENT',
        confirmationVisible: !!nextState.lastVisible,
        confirmationRect: nextState.lastRect
      });
    }, 600);
  }

  function scanForMagic(source) {
    try {
      const confirmText = document.body?.textContent || '';
      if (confirmText === lastMagicText) {
        return;
      }
      lastMagicText = confirmText;
      if (MAGIC_TEXT_REGEX.test(confirmText)) {
        handleMagicLinkDetected(source);
      }
    } catch (e) {}
  }

  function detectMagicLinkRequest() {
    try {
      const observer = new MutationObserver(() => {
        scanForMagic('observer');
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      scanForMagic('initial');
    } catch(e) {
      console.log('Magic link detection error:', e);
    }
  }
  
  if (document.body) {
    detectMagicLinkRequest();
  } else {
    document.addEventListener('DOMContentLoaded', detectMagicLinkRequest);
  }



  function readLoyalty(){
    try {
      const el = Array.from(document.querySelectorAll('body *')).find(e => 
        /earn\\s*\\$?\\d+(\\.\\d{2})?\\s*Loyalty/i.test(e.textContent||'')
      );
      if(el){
        const m = (el.textContent||'').match(/\\$?([0-9]+(?:\\.[0-9]{1,2})?)/);
        if(m && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'LOYALTY_HINT', 
            value: m[1]
          }));
        }
      }
    } catch(e) {}
  }

  function routeHint(){
    try {
      const u = location.href;
      let t = 'HOME';
      if(/\\/products\\/cart/i.test(u)) t='CART';
      else if(/\\/account\\/orders/i.test(u)) t='ORDERS';
      else if(/\\/account(\\/?$|\\?)/i.test(u)) t='PROFILE';
      else if(/\\/products/i.test(u)) t='SEARCH';
      
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ROUTE_HINT', 
          value: t, 
          url: u
        }));
      }
    } catch(e) {}
  }

 
  readLoyalty(); 
  routeHint();
  
  document.addEventListener('click', function() { 
    setTimeout(function() { 
      readLoyalty(); 
      routeHint(); 
    }, 450); 
  }, true);

  window.scrollTo(0, 0);
})();
`;
