// DOCUMENTATION ONLY - This file explains the injected JavaScript
// The actual code is in lib/webviewSkin.ts

/**
 * This script runs inside each WebView to make the GreenHaus website feel native.
 * It removes website chrome (header/footer/breadcrumbs) and communicates with React Native.
 */

(function cleanup() {
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Hide an element with !important CSS
   */
  const hide = (el) => { 
    if (el) {
      el.style.setProperty('display','none','important'); 
      el.style.setProperty('height','0','important');
      el.style.setProperty('overflow','hidden','important');
    }
  };
  
  /**
   * Remove all elements matching a selector
   */
  const rm = (sel) => document.querySelectorAll(sel).forEach(n => {
    if (n && n.parentNode) {
      n.remove();
    }
  });

  // ============================================================================
  // DOM CLEANUP
  // ============================================================================

  function cleanupDOM() {
    // 1. Hide breadcrumbs by aria-label
    hide(document.querySelector('nav[aria-label="Breadcrumbs"]'));
    
    // 2. Remove common breadcrumb classes
    rm('.breadcrumbs, .ins-breadcrumbs, .tpl-breadcrumbs, .Breadcrumbs, nav.breadcrumbs, .Page-breadcrumbs');
    
    // 3. Find and hide breadcrumbs by text content ("Home / Store")
    document.querySelectorAll('nav, .breadcrumbs, .tpl-breadcrumbs, div, section').forEach(nav => {
      if (nav && /home\s*\/\s*store/i.test(nav.textContent || '')) {
        hide(nav);
      }
    });

    // 4. Remove the quick-links grid (Search Products, My Account, etc.)
    // Look for sections containing 4+ of these labels:
    const quickLinkLabels = ['Search Products','My Account','Track Orders','Favorites','Shopping Bag','Gift Cards'];
    document.querySelectorAll('section,div,ul,nav').forEach(block => {
      const t = (block.textContent || '').trim();
      const hasAllLabels = quickLinkLabels.filter(l => t.includes(l)).length >= 4;
      if (hasAllLabels) {
        block.remove();
      }
    });

    // 5. Remove footer elements
    rm('footer, .footer, .site-footer, .Footer, .main-footer');
    rm('#shopify-section-footer, .footer-wrapper, .SiteFooter');
    rm('section[data-section-id*="footer"], section[id*="footer"]');
    rm('.footer-content, .footer__content, .footer-spacer, .footer__spacer');
    rm('.links-grid, .quick-links, .menu-grid, .app-links');
    rm('.drawer-menu, .sticky-bar');

    // 6. Remove white gaps by zeroing padding
    const main = document.querySelector('main') || document.body;
    if (main) {
      main.style.setProperty('padding-top','0','important');
      main.style.setProperty('padding-bottom','0','important');
      main.style.setProperty('margin-bottom','0','important');
      main.style.setProperty('min-height','auto','important');
    }
    document.body.style.setProperty('padding','0','important');
    document.body.style.setProperty('margin','0','important');

    // 7. Ensure links open in same window (no target="_blank")
    document.querySelectorAll('a[target="_blank"]').forEach(a => a.removeAttribute('target'));
  }

  // ============================================================================
  // CART COUNT DETECTION
  // ============================================================================

  /**
   * Extract numeric value from string
   */
  function textNum(t) { 
    return parseInt(String(t || '').toString().replace(/[^0-9]/g, ''), 10) || 0; 
  }

  /**
   * Try to find cart count from multiple possible locations
   * Priority order:
   * 1. Header cart icon badges
   * 2. Cart page quantity inputs
   * 3. localStorage fallback
   */
  function getCartCount() {
    // Try header cart badges (most reliable for all pages)
    const cands = [
      '.cart-count', '.CartCount', '[data-cart-count]',
      '.header-cart-count', '.js-cart-count', '.site-header__cart-count',
      '.cart__count', '[class*="cart-count"]', '[id*="cart-count"]',
      '.bag-count', '.mini-cart__count', '.ins-header_icon--cart',
      '[class*="header__icon"][class*="cart"]', 'a[href*="/products/cart"]'
    ];
    
    for (const sel of cands) {
      const el = document.querySelector(sel);
      if (!el) continue;
      
      // Try data attributes first, then text content
      const raw = el.getAttribute('data-cart-count') || 
                  el.getAttribute('data-count') || 
                  el.textContent || '0';
      const n = textNum(raw);
      if (!isNaN(n) && n > 0) return n;
    }

    // If on cart page, sum up quantity inputs
    const cartInputs = document.querySelectorAll('input[name*="qty"], input.qty, .cart__qty-input, input[type="number"][name*="quantity"]');
    if (cartInputs.length > 0) {
      let total = 0;
      cartInputs.forEach(input => {
        total += parseInt(input.value, 10) || 0;
      });
      if (total > 0) return total;
    }

    // Fallback to localStorage (some themes cache it)
    try {
      const ls = localStorage.getItem('cart_count') || localStorage.getItem('theme:cartCount');
      if (ls) return parseInt(ls, 10) || 0;
    } catch(_e){}
    
    return 0;
  }

  // ============================================================================
  // REACT NATIVE COMMUNICATION
  // ============================================================================

  /**
   * Send message to React Native
   */
  function postMessage(type, payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...payload }));
    }
  }

  /**
   * Post current cart count to React Native
   */
  function postCount() {
    const count = getCartCount();
    postMessage('cart-count', { count });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  // Run cleanup and count on initial load
  cleanupDOM();
  postCount();
  window.scrollTo(0, 0);

  // Watch for DOM changes (SPA navigation, async content)
  const obs = new MutationObserver(() => { 
    try { 
      cleanupDOM(); 
      postCount();
    } catch(e){
      console.error('Cleanup error:', e);
    } 
  });
  obs.observe(document.documentElement, {childList:true, subtree:true});

  // Poll for cart count updates (safety net)
  setInterval(() => {
    postCount();
  }, 1500);
})();
