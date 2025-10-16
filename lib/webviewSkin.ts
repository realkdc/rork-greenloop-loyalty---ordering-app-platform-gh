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

  function detectMagicLinkRequest() {
    try {
      const observer = new MutationObserver(() => {
        const confirmText = document.body.textContent || '';
        if (
          /link.*has.*been.*sent/i.test(confirmText) ||
          /check.*your.*email/i.test(confirmText) ||
          /sent.*you.*link/i.test(confirmText) ||
          /email.*sent/i.test(confirmText) ||
          /we.*sent.*you/i.test(confirmText) ||
          /magic.*link.*sent/i.test(confirmText)
        ) {
          console.log('[Auth] Magic link email detected');
          post({ type: 'EMAIL_LINK_SENT' });
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
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
