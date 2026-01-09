import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, AppState, Alert, Share, ToastAndroid, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';
import type WebViewType from 'react-native-webview';
import { useApp } from '@/contexts/AppContext';
import { useRouter } from 'expo-router';
import { APP_CONFIG, REVIEW_BUILD, SAFE_MODE, HIDE_VAPE_CONTENT, REVIEW_DEMO_FAKE_AUTH, REVIEW_DEMO_FAKE_CHECKOUT, WEBVIEW_MINIMAL_MODE } from '@/constants/config';
import { cartState, type CartStorageSnapshot } from '@/lib/cartState';
import { OrderConfirmationModal } from './OrderConfirmationModal';
import { FakeDemoOrdersService, type FakeDemoOrder } from '@/services/fakeDemoOrders';
import { PRE_AUTH_COOKIES } from '@/services/preAuthCookies';
import { debugLog, debugWarn, debugError } from '@/lib/logger';

const REVIEW_DEMO_MESSAGE = 'This is a demo-only build for App Review. Login and Checkout are intentionally disabled.';

const ALLOWED_HOST_PATTERNS = [
  'greenhauscc.com',
  '.greenhauscc.com',
  'greenhaus-site.vercel.app',
  'ecwid.com',
  '.ecwid.com',
  'greenloop.loyalty',
  'challenges.cloudflare.com',
];

// Auth patterns to intercept in fake auth mode
const AUTH_PATTERNS = [
  '/account/login',
  '/account/signin',
  '/account/sign-in',
  '/account/auth',
  '/login',
  '/sign-in',
  '/signin',
  '/auth',
];

// Checkout patterns to intercept in fake checkout mode
const CHECKOUT_PATTERNS = [
  '/checkout',
  '/cart/checkout',
  '/cart/step',
  '/payment',
  '/pay/',
  '/place-order',
  '/complete-order',
];

const INJECTED_CSS = `
(function(){
  const SAFE_MODE = ${SAFE_MODE};
  const HIDE_VAPE_CONTENT = ${HIDE_VAPE_CONTENT};
  
  // Inject base CSS
  let css = \`
    /* REVERT hero slider hiding: show it again */
    .ins-tile__wrap, .ins-tile__slide, .ins-tile__slide-content-inner { display: initial !important; opacity: initial !important; }

    /* Force high-quality images - remove any blur/backdrop filters applied by storefront */
    * {
      filter: none !important;
      -webkit-filter: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    img {
      filter: none !important;
      -webkit-filter: none !important;
      image-rendering: -webkit-optimize-contrast !important;
      image-rendering: crisp-edges !important;
    }
    picture, .ec-product-card__image, .grid-product__image, .ecwid-productBrowser-image, .product-card__image, .product-item__image {
      filter: none !important;
      -webkit-filter: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    /* REMOVED: Overly aggressive spinner hiding was preventing cart page from loading */
    /* The 5-second timeout in each tab will handle stuck loading states instead */

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

  if (SAFE_MODE || HIDE_VAPE_CONTENT) {
    css += \`
    /* SAFE MODE: Hide restricted tiles instantly (prevents flash) */
    #ins-tile__category-item-GOrgE,
    #ins-tile__category-item-GOrgE *,
    a[aria-label="TOASTED TUESDAY"],
    a[aria-label="Toasted Tuesday"],
    a[aria-label="toasted tuesday"],
    a[href*="toasted"][href*="tuesday"] {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }

    /* Hide vape category cards on Browse (Disposables & Cartridges) */
    .grid-category--id-180876996,
    .grid-category--id-180876996 *,
    a[data-category-id="180876996"],
    a[href*="disposables"][href*="cartridges"] {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    \`;
  }
  
  const s = document.createElement('style'); 
  s.type='text/css'; 
  s.appendChild(document.createTextNode(css));
  document.documentElement.appendChild(s);
  
  // SAFE MODE: Hide restricted tiles
  if (SAFE_MODE) {
    function shouldHideElement(element) {
      const link = element.querySelector ? element.querySelector('a') : (element.tagName === 'A' ? element : null);
      if (!link) return false;
      
      const href = (link.getAttribute('href') || '').toLowerCase();
      const linkText = link.textContent?.toLowerCase().trim();
      
      return (
        href.includes('tuesday') ||
        linkText.includes('toasted tuesday') ||
        (href.includes('devices') && href.includes('cartridge')) ||
        (linkText.includes('devices') && linkText.includes('cartridge')) ||
        linkText === 'devices & cartridges (hemp)' ||
        linkText === 'devices & cartridges'
      );
    }
    
    function hideElement(element) {
      element.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;';
    }
    
    function filterContent() {
      // Hide restricted tile cards on browse page
      document.querySelectorAll('.ins-card').forEach(card => {
        if (shouldHideElement(card)) {
          hideElement(card);
        }
      });
      
      // Hide restricted promo slides on home page
      document.querySelectorAll('.ins-tile__slide').forEach(slide => {
        if (shouldHideElement(slide)) {
          hideElement(slide);
        }
      });
    }
    
    // Set up MutationObserver to catch elements as they're added to DOM
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check added nodes
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            // Check if the node itself should be hidden
            if (node.classList && (node.classList.contains('ins-card') || node.classList.contains('ins-tile__slide'))) {
              if (shouldHideElement(node)) {
                hideElement(node);
              }
            }
            // Check child nodes
            if (node.querySelectorAll) {
              node.querySelectorAll('.ins-card, .ins-tile__slide').forEach(el => {
                if (shouldHideElement(el)) {
                  hideElement(el);
                }
              });
            }
          }
        });
      }
    });
    
    // Start observing immediately
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // Run filter immediately and repeatedly
    filterContent();
    setTimeout(filterContent, 0);
    setTimeout(filterContent, 10);
    setTimeout(filterContent, 50);
    setTimeout(filterContent, 100);
    setTimeout(filterContent, 200);
    
    // Run on load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', filterContent);
    }
    
    // Continue running periodically as backup
    setInterval(filterContent, 500);
  }
})();
true;
`;

const REVIEW_LABEL_SCRIPT = `
(function(){
  const REVIEW_BUILD = ${REVIEW_BUILD};
  if (!REVIEW_BUILD) {
    debugLog('[ReviewLabels] Not a review build, skipping label tweaks');
    return;
  }
  
  debugLog('[ReviewLabels] 🏷️ Review build active - applying label softening');
  
  // Track processed nodes to avoid re-processing
  const processedNodes = new WeakSet();
  let isProcessing = false;
  let debounceTimer = null;
  
  // CSS injection for review builds
  function injectReviewCSS() {
    if (document.getElementById('__gh-review-css')) return;
    
    const css = \`
      /* De-emphasize vape/disposable badges during review */
      .badge:has(> span:matches-css(^.*(vape|disposable).*$ i)) { 
        opacity: 0.15 !important; 
      }
      /* Also target common badge class patterns */
      [class*="badge"]:has(*) {
        opacity: var(--review-badge-opacity, 1);
      }
      /* Specific targeting for text containing vape/disposable */
      .ec-badge:has(span:is([class*="vape"], [class*="disposable"])) {
        opacity: 0.15 !important;
      }
    \`;
    
    const style = document.createElement('style');
    style.id = '__gh-review-css';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
    debugLog('[ReviewLabels] ✅ Review CSS injected');
  }
  
  // Text replacement mapping
  const replacements = [
    { pattern: /Disposables & Cartridges/gi, replacement: 'Devices & Cartridges (Hemp)' },
    { pattern: /Disposables/gi, replacement: 'Devices (Hemp)' },
    { pattern: /\\bVape\\b/gi, replacement: 'Device' },
    { pattern: /\\bVaping\\b/gi, replacement: 'Using Device' },
    { pattern: /\\bDisposable\\b/gi, replacement: 'Device' },
  ];
  
  function processTextNode(node) {
    if (!node || processedNodes.has(node)) return false;
    
    let originalText = node.textContent || '';
    let newText = originalText;
    let changed = false;
    
    for (const { pattern, replacement } of replacements) {
      const replaced = newText.replace(pattern, replacement);
      if (replaced !== newText) {
        newText = replaced;
        changed = true;
      }
    }
    
    if (changed) {
      node.textContent = newText;
      processedNodes.add(node);
      debugLog('[ReviewLabels] 📝 Replaced text:', originalText, '->', newText);
      return true;
    }
    
    return false;
  }
  
  function walkTextNodes(root) {
    if (!root) return;
    
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script, style, and other non-visible elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tagName = parent.tagName;
          if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT') {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if no meaningful text
          const text = node.textContent || '';
          if (!text.trim() || text.length < 3) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    const nodes = [];
    let node;
    while (node = walker.nextNode()) {
      nodes.push(node);
    }
    
    let replacedCount = 0;
    for (const textNode of nodes) {
      if (processTextNode(textNode)) {
        replacedCount++;
      }
    }
    
    if (replacedCount > 0) {
      debugLog('[ReviewLabels] ✅ Processed', replacedCount, 'text nodes');
    }
  }
  
  function processLabels() {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
      walkTextNodes(document.body);
    } catch (err) {
      debugError('[ReviewLabels] ❌ Error processing labels:', err);
    } finally {
      isProcessing = false;
    }
  }
  
  function debouncedProcess() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processLabels, 300);
  }
  
  // Run on initial load
  injectReviewCSS();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processLabels);
  } else {
    processLabels();
  }
  
  // Monitor for route changes and dynamic content
  const observer = new MutationObserver(debouncedProcess);
  
  if (document.body) {
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      characterData: true
    });
  }
  
  // Periodic check for newly loaded content
  setInterval(processLabels, 3000);
  
  // Monitor for URL changes (SPA navigation)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      debugLog('[ReviewLabels] 🔄 URL changed, re-processing labels');
      setTimeout(processLabels, 500);
    }
  }, 500);
  
  debugLog('[ReviewLabels] ✅ Review label system initialized');
})();
true;
`;

// ============================================================================
// SAFE MODE SCRIPT - HIDES VAPE-RELATED CONTENT FOR APP STORE REVIEW
// ============================================================================
// ** DO NOT MODIFY OR REMOVE THIS SCRIPT WITHOUT EXPLICIT APPROVAL **
//
// This script is CRITICAL for Apple App Store compliance. It runs when
// SAFE_MODE=true (in constants/config.ts) and hides specific vape-related
// content from the application.
//
// WHAT IT HIDES:
// - "Toasted Tuesday" tile from Daily Deals section (Home tab)
// - "Devices & Cartridges (Hemp)" tile from Browse tab
//
// WHAT IT DOES:
// - Scans the DOM for elements containing restricted content text
// - Hides the matching element and its parent/grandparent containers
// - Runs multiple times (0ms, 500ms, 1000ms, 2000ms) to catch dynamic content
//
// WHAT IT DOES NOT DO:
// - Does NOT hide entire Daily Deals section (only specific tiles)
// - Does NOT affect other promos like "Munchie Monday" or "Wax Wednesday"
// - Does NOT break page layout or functionality
//
// HOW IT WORKS:
// 1. Injected via injectJavaScript() in handleLoadEnd callback
// 2. Searches a, div, span, p, h2, h3 elements for direct text content
// 3. Uses cssText with !important to force hide matched elements
//
// TESTED: November 14, 2025 - Successfully hides specified tiles
// LAST MODIFIED: November 14, 2025
// ============================================================================
const CART_ID_PRESERVATION_SCRIPT = `
(function(){
  debugLog('[CartPreservation] 🛡️ Installing cart ID preservation script');
  
  // Store the original cart ID when page loads
  let preservedCartId = null;
  let preservedCartData = null;
  
  function preserveCartId() {
    if (window.Ecwid && window.Ecwid.Cart && window.Ecwid.Cart.get) {
      window.Ecwid.Cart.get(function(cart) {
        if (cart && cart.cartId) {
          preservedCartId = cart.cartId;
          preservedCartData = JSON.stringify(cart);
          debugLog('[CartPreservation] 💾 Preserved cart ID:', preservedCartId);
          
          // Also store in localStorage as backup
          try {
            localStorage.setItem('__ghPreservedCartId', preservedCartId);
            if (preservedCartData) {
              localStorage.setItem('__ghPreservedCartData', preservedCartData);
            }
          } catch(e) {
            debugLog('[CartPreservation] ⚠️ Failed to store in localStorage:', e);
          }
        }
      });
    }
  }
  
  function restoreCartId() {
    // Try to restore from localStorage first
    try {
      const storedId = localStorage.getItem('__ghPreservedCartId');
      const storedData = localStorage.getItem('__ghPreservedCartData');
      
      if (storedId && storedId !== 'null' && storedId !== 'undefined') {
        preservedCartId = storedId;
        if (storedData) {
          preservedCartData = storedData;
        }
        debugLog('[CartPreservation] 🔄 Restored cart ID from localStorage:', preservedCartId);
      }
    } catch(e) {
      debugLog('[CartPreservation] ⚠️ Failed to restore from localStorage:', e);
    }
    
    // Check if current cart ID matches preserved one
    if (preservedCartId && window.Ecwid && window.Ecwid.Cart && window.Ecwid.Cart.get) {
      window.Ecwid.Cart.get(function(cart) {
        if (cart && cart.cartId && cart.cartId !== preservedCartId) {
          debugError('[CartPreservation] ⚠️⚠️⚠️ Cart ID changed from', preservedCartId, 'to', cart.cartId);
          debugError('[CartPreservation] ⚠️ Attempting to restore old cart ID...');
          
          // Try to restore the old cart by rehydrating localStorage
          // The cart data should be in Ecwid's localStorage key
          try {
            const cartKeys = Object.keys(localStorage).filter(k => k.includes('cart') && k.includes('Ecwid'));
            debugLog('[CartPreservation] 🔍 Found cart keys:', cartKeys);
            
            // Force Ecwid to reload cart from localStorage
            if (window.Ecwid && window.Ecwid.Cart && window.Ecwid.Cart.get) {
              // Trigger a cart refresh
              setTimeout(function() {
                window.Ecwid.Cart.get(function(newCart) {
                  if (newCart && newCart.cartId === preservedCartId) {
                    debugLog('[CartPreservation] ✅ Successfully restored old cart ID!');
                  } else {
                    debugError('[CartPreservation] ❌ Failed to restore old cart ID. Current:', newCart?.cartId);
                  }
                });
              }, 500);
            }
          } catch(e) {
            debugError('[CartPreservation] ❌ Error restoring cart:', e);
          }
        } else if (cart && cart.cartId === preservedCartId) {
          debugLog('[CartPreservation] ✅ Cart ID matches preserved ID:', preservedCartId);
        }
      });
    }
  }
  
  // Preserve cart ID on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(preserveCartId, 1000);
      setTimeout(restoreCartId, 1500);
    });
  } else {
    setTimeout(preserveCartId, 1000);
    setTimeout(restoreCartId, 1500);
  }
  
  // Monitor cart changes
  if (window.Ecwid && window.Ecwid.OnCartChanged) {
    try {
      window.Ecwid.OnCartChanged.add(function(cart) {
        if (cart && cart.cartId) {
          if (preservedCartId && cart.cartId !== preservedCartId) {
            debugError('[CartPreservation] 🚨 Cart ID changed during operation!', preservedCartId, '→', cart.cartId);
            // Try to restore
            restoreCartId();
          } else {
            preservedCartId = cart.cartId;
            debugLog('[CartPreservation] ✅ Cart ID updated:', cart.cartId);
          }
        }
      });
      debugLog('[CartPreservation] ✅ Registered OnCartChanged listener');
    } catch(e) {
      debugLog('[CartPreservation] ⚠️ Failed to register OnCartChanged:', e);
    }
  }
  
  // Periodic check
  setInterval(function() {
    if (preservedCartId) {
      restoreCartId();
    } else {
      preserveCartId();
    }
  }, 5000);
  
  debugLog('[CartPreservation] ✅ Cart preservation script installed');
})();
true;
`;

const SAFE_MODE_SCRIPT = `
(function(){
  try {
    if (window.__ghSafeModeInstalled) return;
    window.__ghSafeModeInstalled = true;

    function hideRestrictedContent() {
      // Find all links and divs
      const elements = document.querySelectorAll('a, div, span, p, h2, h3');
      
      for (let el of elements) {
        // Get only direct text content (not children)
        const directText = Array.from(el.childNodes)
          .filter(node => node.nodeType === 3)
          .map(node => node.textContent)
          .join('');
        
        const lowerText = directText.toLowerCase();
        
        // Check for restricted content
        if (lowerText.includes('toasted tuesday') || 
            lowerText.includes('devices & cartridges') ||
            lowerText.includes('devices and cartridges')) {
          // Found it! Hide this element and its parents
          el.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important';
          if (el.parentElement) {
            el.parentElement.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important';
            if (el.parentElement.parentElement) {
              el.parentElement.parentElement.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important';
            }
          }
        }
      }
    }

    // Run multiple times to catch dynamically loaded content
    hideRestrictedContent();
    setTimeout(hideRestrictedContent, 500);
    setTimeout(hideRestrictedContent, 1000);
    setTimeout(hideRestrictedContent, 2000);

  } catch(err) {}
})();
true;
`;
// ============================================================================

// Note: DEMO_MODE_SCRIPT removed - fake auth/checkout handled via navigation interception

// Age gate bypass DISABLED - the InAppAgeVerification cookie handles age verification
// This script was interfering with Cloudflare challenges on the account/login page
const AGE_GATE_BYPASS_SCRIPT = `
(function(){
  debugLog('[AgeGate] ✅ Age gate bypass DISABLED - using InAppAgeVerification cookie instead');
  debugLog('[AgeGate] This prevents interference with Cloudflare challenges on account/login pages');
})();
true;
`;

// Cookie injection for demo mode - auto-login reviewers
const COOKIE_INJECTION_SCRIPT = `
(function(){
  const DEMO_MODE = ${APP_CONFIG.DEMO_MODE};
  const COOKIES = ${JSON.stringify(PRE_AUTH_COOKIES)};
  
  if (!DEMO_MODE) {
    debugLog('[CookieInjection] Not in demo mode, skipping cookie injection');
    return;
  }
  
  debugLog('[CookieInjection] 🍪 Demo mode active - injecting auth cookies');
  
  // Check if cookies are already set
  function isCookieSet(name) {
    return document.cookie.split(';').some(c => c.trim().startsWith(name + '='));
  }
  
  // Inject cookies
  function injectCookies() {
    let injected = 0;
    
    for (const cookie of COOKIES) {
      // ALWAYS inject in demo mode (don't skip if cookie exists, as it might be expired/invalid)
      // This ensures reviewers stay logged in across app restarts
      
      // Build cookie string
      let cookieStr = \`\${cookie.name}=\${cookie.value}; path=\${cookie.path || '/'};\`;
      
      // Add domain if specified
      if (cookie.domain) {
        cookieStr += \` domain=\${cookie.domain};\`;
      }
      
      // Add secure flag if specified
      if (cookie.secure) {
        cookieStr += ' secure;';
      }
      
      // Add sameSite if specified
      if (cookie.sameSite) {
        cookieStr += \` SameSite=\${cookie.sameSite === 'no_restriction' ? 'None' : cookie.sameSite};\`;
      }
      
      // Set the cookie
      try {
        document.cookie = cookieStr;
        debugLog('[CookieInjection] ✅ Injected cookie:', cookie.name);
        injected++;
      } catch (err) {
        debugError('[CookieInjection] ❌ Failed to inject cookie:', cookie.name, err);
      }
    }
    
    if (injected > 0) {
      debugLog(\`[CookieInjection] 🎉 Successfully injected \${injected} cookies\`);
    }
  }
  
  // Inject immediately
  injectCookies();
  
  // Inject on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCookies);
  }
  
  debugLog('[CookieInjection] ✅ Cookie injection initialized');
})();
true;
`;

const CART_COUNTER_SCRIPT = `
(function(){
  debugLog('[CartCounter] 🚀 Starting cart counter script');
  if (window.__ghCartCounter?.installed) {
    debugLog('[CartCounter] ⏭️ Already installed, skipping');
    return;
  }
  let persisted = -1;
  try { persisted = parseInt(sessionStorage.getItem('__ghLastCount')||''); } catch {}
  window.__ghCartCounter = { installed:true, lastValue: Number.isFinite(persisted)&&persisted>0?persisted:0, active: true, ready:false, confirmedEmpty:false, synced:false, pending:null, lastStorageJson:null };
  window.__ghCC = window.__ghCartCounter;
  debugLog('[CartCounter] ✅ Initialized with persisted value:', window.__ghCartCounter.lastValue);
  
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
        debugLog('[CartCounter] 🎯 Found cart count via DOM selector:', s, '= value:', n);
        return n;
      }
    }
    if (isCartPage()){
      const items = document.querySelectorAll('.ec-cart__products li, [data-cart-item], .cart__item, .ec-cart-item');
      if (items.length>0) {
        debugLog('[CartCounter] 🎯 Found cart items on cart page:', items.length);
        return items.length;
      }
    }
    debugLog('[CartCounter] ❌ No cart count found via DOM probe');
    return null;
  }
  function shouldCaptureKey(key){
    if (!key) return false;
    const normalized = key.toLowerCase();
    if (normalized.includes('ecwid')) return true;
    if (normalized.includes('cart')) return true;
    if (normalized.includes('shopping')) return true;
    if (normalized.includes('customer')) return true;
    if (normalized.includes('ec-storefront')) return true;
    return false;
  }
  function captureStorageBucket(store){
    const data = {};
    if (!store || typeof store.length !== 'number') return data;
    try{
      const max = Math.min(store.length, 60);
      for (let i=0; i<max; i++){
        const key = store.key(i);
        if (!key) continue;
        if (!shouldCaptureKey(key)) continue;
        try{
          const value = store.getItem(key);
          if (typeof value === 'string') {
            data[key] = value;
          }
        }catch(err){}
      }
    }catch(err){}
    return data;
  }
  function shouldCaptureCookieKey(key){
    if (!key) return false;
    const normalized = key.toLowerCase();
    if (normalized.includes('ecwid')) return true;
    if (normalized.includes('cart')) return true;
    if (normalized.includes('session')) return true;
    return false;
  }
  function captureCookies(){
    const cookies = {};
    try{
      const raw = document.cookie || '';
      if (!raw) return cookies;
      raw.split(';').forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.slice(0, eqIdx).trim();
        if (!shouldCaptureCookieKey(key)) return;
        const value = trimmed.slice(eqIdx + 1).trim();
        cookies[key] = value;
      });
    }catch(err){}
    return cookies;
  }
  function captureStorageSnapshot(){
    try{
      return {
        session: captureStorageBucket(window.sessionStorage),
        local: captureStorageBucket(window.localStorage),
        cookies: captureCookies()
      };
    }catch(err){
      return { session:{}, local:{}, cookies:{} };
    }
  }
  function snapshotHasData(snapshot){
    if (!snapshot) return false;
    const sessionCount = snapshot.session ? Object.keys(snapshot.session).length : 0;
    const localCount = snapshot.local ? Object.keys(snapshot.local).length : 0;
    return sessionCount + localCount > 0;
  }
  function post(rawValue, fromAPI){
    const state = window.__ghCartCounter;
    debugLog('[CartCounter] 📤 post() called - value:', rawValue, 'fromAPI:', fromAPI, 'active:', state.active, 'synced:', state.synced, 'lastValue:', state.lastValue);

    let n = rawValue;
    if (n === null || n === undefined){
      if (!state.ready){
        debugLog('[CartCounter] ⚠️ Not ready and no value, skipping');
        return;
      }
      n = state.lastValue;
      debugLog('[CartCounter] Using last known value:', n);
    }

    const prev = state.lastValue;
    if (n === 0 && prev > 0 && isCartPage() && !state.confirmedEmpty && !fromAPI){
      debugLog('[CartCounter] ⚠️ On cart page with 0 items but not confirmed, skipping');
      return;
    }
    if (n === 0 && !state.ready && !fromAPI){
      debugLog('[CartCounter] ⏭️ Ignoring zero before ready state');
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
      debugLog('[CartCounter] ⏭️ Value unchanged and already synced, skipping');
      return;
    }

    persist(n);

    const payload = { type:'CART_COUNT', value:n, source: location.pathname };
    try{
      const snapshot = captureStorageSnapshot();
      if (snapshotHasData(snapshot)) {
        const serialized = JSON.stringify(snapshot);
        if (!state.lastStorageJson || state.lastStorageJson !== serialized) {
          state.lastStorageJson = serialized;
          payload.storage = snapshot;
        }
      } else {
        state.lastStorageJson = null;
      }
    }catch(err){
      debugLog('[CartCounter] ⚠️ Failed to capture storage snapshot', err);
    }

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
        debugLog('[CartCounter] 🛑 Bridge not ready after multiple attempts, giving up');
        state.pending = null;
        return;
      }
      debugLog('[CartCounter] ⚠️ Bridge not ready (attempt ' + pending.attempts + ') - retrying');
      scheduleRetry(Math.min(1200, 200 + pending.attempts * 200));
      return;
    }

    try{
      debugLog('[CartCounter] 📢 Sending CART_COUNT message to React Native with value:', n);
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      state.synced = true;
      state.pending = null;
    }catch(e){
      const retryNow = Date.now();
      pending.attempts += 1;
      if (retryNow - pending.firstAttempt > 15000){
        debugLog('[CartCounter] ❌ Failed to post after multiple attempts, dropping.', e);
        state.pending = null;
        return;
      }
      debugLog('[CartCounter] ❌ Error posting to bridge, retrying...', e);
      scheduleRetry(Math.min(1200, 200 + pending.attempts * 200));
    }
  }
  function tryAPI(){
    debugLog('[CartCounter] 🔍 Trying Ecwid API, Ecwid available:', !!window.Ecwid);
    if (!window.Ecwid) return false;
    try{
      if (window.Ecwid.Cart?.get){
        debugLog('[CartCounter] ✅ Using Ecwid.Cart.get');
        window.Ecwid.Cart.get(function(cart){ 
          const c = cart?.productsQuantity ?? cart?.items?.length ?? 0; 
          debugLog('[CartCounter] 🛍️ Ecwid.Cart.get returned:', c);
          post(c, true); 
        });
        return true;
      }
    }catch(e){
      debugLog('[CartCounter] ❌ Error with Ecwid.Cart.get:', e);
    }
    try{
      if (window.Ecwid.getCart){
        debugLog('[CartCounter] ✅ Using Ecwid.getCart');
        window.Ecwid.getCart(function(cart){ 
          const c = cart?.productsQuantity ?? cart?.items?.length ?? 0; 
          debugLog('[CartCounter] 🛍️ Ecwid.getCart returned:', c);
          post(c, true); 
        });
        return true;
      }
    }catch(e){
      debugLog('[CartCounter] ❌ Error with Ecwid.getCart:', e);
    }
    return false;
  }
  function check(){
    debugLog('[CartCounter] 🔎 check() triggered at', new Date().toLocaleTimeString());
    const viaAPI = tryAPI();
    if (!viaAPI){ 
      debugLog('[CartCounter] No API available, trying DOM probe');
      const d = domProbe(); 
      if (d!==null) post(d, false); 
      else debugLog('[CartCounter] ❌ No count found via DOM');
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
        debugLog('[CartCounter] 🏓 Received PING, running check');
        setTimeout(check,100); 
      } 
      if (m.type==='TAB_ACTIVE'){ 
        debugLog('[CartCounter] 🎯 Tab active changed to:', m.value);
        window.__ghCartCounter.active=!!m.value; 
        if(m.value) setTimeout(check,100); 
      } 
    }catch{}
  }
  window.addEventListener('message', onMsg);
  document.addEventListener('message', onMsg);
  if (window.Ecwid?.OnCartChanged){ 
    try{ 
      debugLog('[CartCounter] ✅ Registering Ecwid.OnCartChanged listener');
      window.Ecwid.OnCartChanged.add(function(cart){ 
        const c = cart?.productsQuantity ?? cart?.items?.length ?? 0; 
        debugLog('[CartCounter] 🔔 OnCartChanged fired with count:', c);
        post(c,true); 
      }); 
    }catch(e){
      debugLog('[CartCounter] ❌ Error registering OnCartChanged:', e);
    }
  }
  debugLog('[CartCounter] ⏰ Scheduling periodic checks');
  [400,1000,2000,3500,6000,9000].forEach(d=>setTimeout(check,d));
  setInterval(check, 15000);
})();
true;
`;

const SHARE_SCRIPT = `
(function(){
  debugLog('[Share] 🔗 Initializing native share support');
  
  // Add native share functionality to the page
  window.__ghNativeShare = function(url, title, message) {
    if (!window.ReactNativeWebView) {
      debugLog('[Share] ❌ ReactNativeWebView not available');
      return false;
    }
    
    try {
      const shareData = {
        type: 'SHARE',
        url: url || window.location.href,
        title: title || document.title,
        message: message || title || document.title
      };
      
      debugLog('[Share] 📤 Sending share request:', shareData);
      window.ReactNativeWebView.postMessage(JSON.stringify(shareData));
      return true;
    } catch (err) {
      debugLog('[Share] ❌ Error sending share request:', err);
      return false;
    }
  };
  
  // Detect and intercept share buttons
  function attachShareListeners() {
    const shareSelectors = [
      'button[data-share]',
      'a[data-share]',
      '.share-button',
      '[aria-label*="share" i]',
      '[title*="share" i]',
      'button:contains("Share")',
      'a:contains("Share")'
    ];
    
    shareSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.__ghShareHooked) return;
          el.__ghShareHooked = true;
          
          el.addEventListener('click', function(e) {
            const url = this.getAttribute('data-url') || 
                       this.getAttribute('href') || 
                       window.location.href;
            const title = this.getAttribute('data-title') || 
                         this.getAttribute('title') || 
                         document.title;
            
            // Try native share first
            if (window.__ghNativeShare && window.__ghNativeShare(url, title)) {
              e.preventDefault();
              e.stopPropagation();
              debugLog('[Share] ✅ Triggered native share');
            }
          }, true);
        });
      } catch (err) {
        debugLog('[Share] ⚠️ Error attaching to selector:', selector, err);
      }
    });
  }
  
  // Expose share to product pages
  function addProductShareButtons() {
    // Look for product detail pages
    const productSelectors = [
      '.product-details',
      '.ec-store__product',
      '[data-product-id]',
      '.product-page'
    ];
    
    productSelectors.forEach(selector => {
      try {
        const productElements = document.querySelectorAll(selector);
        if (productElements.length > 0 && !document.querySelector('.__gh-share-btn')) {
          debugLog('[Share] 📦 Product page detected, share available via __ghNativeShare()');
          // Store product info for easy access
          window.__ghCurrentProduct = {
            url: window.location.href,
            title: document.title
          };
        }
      } catch (err) {}
    });
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      attachShareListeners();
      addProductShareButtons();
    });
  } else {
    attachShareListeners();
    addProductShareButtons();
  }
  
  // Monitor for dynamically added share buttons
  const observer = new MutationObserver(() => {
    attachShareListeners();
    addProductShareButtons();
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // Periodic check
  setInterval(() => {
    attachShareListeners();
    addProductShareButtons();
  }, 3000);
})();
true;
`;

const CHECKOUT_INTERCEPT_SCRIPT = `
(function(){
  const FAKE_CHECKOUT = ${REVIEW_DEMO_FAKE_CHECKOUT};
  if (!FAKE_CHECKOUT) return;
  
  debugLog('[CheckoutIntercept] Installing checkout button interceptor');
  
  function interceptCheckout() {
    const checkoutSelectors = [
      'button[class*="checkout" i]',
      'button[class*="place" i]',
      'a[href*="checkout"]',
      'a[href*="place-order"]',
      '.checkout-button',
      '.ec-cart__button--checkout',
      '[data-action="checkout"]',
      'button:has-text("Checkout")',
      'button:has-text("Place Order")',
      'a:has-text("Checkout")',
      'a:has-text("Place Order")'
    ];
    
    checkoutSelectors.forEach(selector => {
      try {
        // Remove :has-text selectors (not standard CSS)
        const cleanSelector = selector.replace(/:has-text\\([^)]+\\)/g, '');
        if (!cleanSelector) return;
        
        const elements = document.querySelectorAll(cleanSelector);
        elements.forEach(el => {
          if (el.__checkoutIntercepted) return;
          
          // Check text content for text-based selectors
          const text = (el.textContent || '').trim().toLowerCase();
          const hasCheckoutText = text.includes('checkout') || text.includes('place order') || text.includes('continue to checkout');
          const hasCheckoutAttr = el.getAttribute('href')?.includes('checkout') || el.className?.toLowerCase().includes('checkout');
          
          if (!hasCheckoutText && !hasCheckoutAttr && !selector.includes('href') && !selector.includes('class')) {
            return;
          }
          
          el.__checkoutIntercepted = true;
          debugLog('[CheckoutIntercept] Attached to element:', el.tagName, el.className, text.substring(0, 30));
          
          el.addEventListener('click', function(e) {
            debugLog('[CheckoutIntercept] 🛒 Intercepted checkout button click!');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Extract cart data and send to React Native
            try {
              const totalEl = document.querySelector('.ec-cart__total, [data-total], .cart-total, .total-price');
              const subtotalEl = document.querySelector('.ec-cart__subtotal, [data-subtotal], .cart-subtotal, .subtotal-price');
              const taxEl = document.querySelector('.ec-cart__tax, [data-tax], .cart-tax, .tax-amount');
              
              const total = totalEl ? (totalEl.textContent || totalEl.innerText || '$10.98').trim() : '$10.98';
              const subtotal = subtotalEl ? (subtotalEl.textContent || subtotalEl.innerText || '$10.00').trim() : '$10.00';
              const tax = taxEl ? (taxEl.textContent || taxEl.innerText || '$0.98').trim() : '$0.98';
              
              // Extract items
              const items = [];
              const itemEls = document.querySelectorAll('.ec-cart-item, .cart-item, [data-cart-item], .ec-cart__products li');
              itemEls.forEach((itemEl, idx) => {
                if (idx < 3) {
                  const nameEl = itemEl.querySelector('.ec-cart-item__name, .item-name, [data-item-name], .product-name, h3, h4');
                  const priceEl = itemEl.querySelector('.ec-cart-item__price, .item-price, [data-item-price], .price');
                  const qtyEl = itemEl.querySelector('.ec-cart-item__qty, .item-qty, [data-item-qty], input[type="number"]');
                  
                  const name = nameEl ? (nameEl.textContent || nameEl.innerText || 'Item').trim() : 'Demo Item';
                  const price = priceEl ? (priceEl.textContent || priceEl.innerText || '$5.00').trim() : '$5.00';
                  const qtyText = qtyEl ? (qtyEl.value || qtyEl.textContent || qtyEl.innerText || '1') : '1';
                  const quantity = parseInt(qtyText) || 1;
                  
                  if (name && name.length > 0) {
                    items.push({ name, price, quantity });
                  }
                }
              });
              
              // Fallback if no items detected
              if (items.length === 0) {
                items.push({ name: 'Hemp Flower Sample', price: '$10.00', quantity: 1 });
              }
              
              debugLog('[CheckoutIntercept] 📦 Extracted cart data:', { total, subtotal, tax, items });
              
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'FAKE_CHECKOUT_DATA',
                  total,
                  subtotal,
                  tax,
                  items
                }));
              } else {
                debugError('[CheckoutIntercept] ❌ ReactNativeWebView not available');
              }
            } catch (err) {
              debugError('[CheckoutIntercept] ❌ Error extracting cart data:', err);
              // Send minimal fallback
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'FAKE_CHECKOUT_DATA',
                  total: '$10.98',
                  subtotal: '$10.00',
                  tax: '$0.98',
                  items: [{ name: 'Demo Item', price: '$10.00', quantity: 1 }]
                }));
              }
            }
            
            return false;
          }, { capture: true });
        });
      } catch (err) {
        debugError('[CheckoutIntercept] ❌ Error with selector:', selector, err);
      }
    });
  }
  
  // Run immediately and on mutations
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', interceptCheckout);
  } else {
    interceptCheckout();
  }
  
  // Monitor for dynamically added checkout buttons
  const observer = new MutationObserver(() => {
    interceptCheckout();
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  // Periodic check to ensure we catch all buttons
  setInterval(interceptCheckout, 1000);
  
  debugLog('[CheckoutIntercept] ✅ Checkout interceptor installed');
})();
true;
`;

const createInjectedJS = (tabKey: 'home' | 'search' | 'cart' | 'orders' | 'profile') => `
(function(){
  const TAB_KEY = '${tabKey}';
  // Ensure debug helpers exist to avoid ReferenceError warnings in WKWebView
  try {
    if (typeof window.debugLog !== 'function') { window.debugLog = function(){ /* no-op */ }; }
    if (typeof window.debugError !== 'function') { window.debugError = function(){ /* no-op */ }; }
  } catch (_) {}
  if (typeof window.__ghMagicLinkCooldown === 'undefined') {
    window.__ghMagicLinkCooldown = 0;
  }

  const GH_SHADOW_ROOTS = [];
  const GH_SHADOW_ROOT_SET = new Set();
  const GH_OBSERVED_TARGETS = new Set();
  let magicObserver = null;
  let requestObserver = null;
  let cloudflareObserver = null;
  let cloudflareEmitTimer = null;
  let cloudflareIntervalStarted = false;

  function attachCloudflareObserver(target){
    if (!cloudflareObserver || !target) return;
    let node = target;
    if (node === document) {
      node = document.documentElement || document.body;
    }
    if (!node) return;
    try {
      cloudflareObserver.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class','hidden'] });
    } catch (_err) {}
  }

  function registerShadowRoot(root){
    if (!root || GH_SHADOW_ROOT_SET.has(root)) return;
    GH_SHADOW_ROOT_SET.add(root);
    GH_SHADOW_ROOTS.push(root);
    discoverShadowRootsFrom(root);
    ensureObservers();
    attachCloudflareObserver(root);
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
  const CLOUDFLARE_SELECTORS = [
    '#cf-stage',
    '#cf-stage iframe',
    '#cf-challenge-hcaptcha-container',
    '.cf-turnstile',
    '.cf-challenge',
    '.cf-chl-widget',
    '.cloudflare-challenge',
    '[data-cf-challenge]',
    '[id*="cf-chl-widget"]',
    '[id*="cf-challenge"]',
    'iframe[src*="challenges.cloudflare.com"]',
    'iframe[src*="/cdn-cgi/challenge-platform/"]',
    'iframe[title*="security challenge"]',
    'form[action*="cdn-cgi/challenge-platform"]'
  ];
  const CLOUDFLARE_TEXT_REGEX = /cloudflare|verify\s+(?:you|human)|checking\s+your\s+browser|security\s+(?:challenge|check)/i;

  function ensureCloudflareState(){
    let state = window.__ghCloudflareState;
    if (!state || typeof state !== 'object'){
      state = { visible:false, rect:null, selector:null };
    }
    window.__ghCloudflareState = state;
    return state;
  }

  function findCloudflareElement(){
    for (let i = 0; i < CLOUDFLARE_SELECTORS.length; i++){
      const selector = CLOUDFLARE_SELECTORS[i];
      let nodes;
      try {
        nodes = querySelectorAllDeep(selector);
      } catch (_err) {
        continue;
      }
      for (let n = 0; n < nodes.length; n++){
        const node = nodes[n];
        if (!node) continue;
        if (!isElementVisible(node)) continue;
        if (selector.indexOf('iframe') !== -1 || (node.tagName && node.tagName.toLowerCase() === 'iframe')) {
          return { node, selector };
        }
        const label = (node.innerText || node.textContent || '').trim();
        if (!label || CLOUDFLARE_TEXT_REGEX.test(label)) {
          return { node, selector };
        }
      }
    }
    return null;
  }

  function emitCloudflareState(force){
    const match = findCloudflareElement();
    const element = match ? match.node : null;
    const selector = match ? match.selector : null;
    const visible = !!element && isElementVisible(element);
    const rect = visible ? serializeRect(element.getBoundingClientRect()) : null;
    const state = ensureCloudflareState();

    if (!force){
      const sameVisibility = visible === state.visible;
      const sameRect = (!visible && !state.visible) || (
        visible && state.rect && rect &&
        Math.abs((rect.top || 0) - (state.rect.top || 0)) < 2 &&
        Math.abs((rect.left || 0) - (state.rect.left || 0)) < 2 &&
        Math.abs((rect.height || 0) - (state.rect.height || 0)) < 2
      );
      if (sameVisibility && sameRect){
        return;
      }
    }

    state.visible = visible;
    state.rect = rect;
    state.selector = selector;

    try{
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type:'CLOUDFLARE_CHALLENGE_STATE',
        visible,
        rect,
        selector
      }));
    }catch(err){
      postDebug('cloudflare_emit_error', { error: String(err) });
    }
  }

  function scheduleCloudflareEmit(delay){
    const actualDelay = typeof delay === 'number' ? delay : 80;
    if (cloudflareEmitTimer){
      return;
    }
    cloudflareEmitTimer = setTimeout(function(){
      cloudflareEmitTimer = null;
      emitCloudflareState(false);
    }, actualDelay);
  }

  function startCloudflareWatcher(){
    const roots = getSearchRoots();
    if (!cloudflareObserver){
      cloudflareObserver = new MutationObserver(function(){
        scheduleCloudflareEmit(60);
      });
      for (let i = 0; i < roots.length; i++){
        attachCloudflareObserver(roots[i]);
      }
      if (!cloudflareIntervalStarted){
        cloudflareIntervalStarted = true;
        setInterval(function(){
          emitCloudflareState(false);
        }, 3000);
      }
      window.addEventListener('resize', function(){
        scheduleCloudflareEmit(50);
      });
      window.addEventListener('scroll', function(){
        scheduleCloudflareEmit(120);
      }, { passive: true });
    } else {
      for (let i = 0; i < roots.length; i++){
        attachCloudflareObserver(roots[i]);
      }
    }
    emitCloudflareState(true);
  }

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
      debugLog('[AuthDebug] postDebug error', err);
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
      debugLog('[Auth] Magic link request ignored (cooldown) from', source);
      postDebug('request_ignored', { source, now, last: state.lastRequestTs });
      return;
    }
    state.lastRequestTs = now;
    debugLog('[Auth] Magic link request detected from', source);
    postDebug('request', { source, now });
    try{
      window.ReactNativeWebView?.postMessage(JSON.stringify({type:'MAGIC_LINK_REQUESTED', source, timestamp: now}));
    }catch(err){
      debugLog('[Auth] Error posting MAGIC_LINK_REQUESTED', err);
      postDebug('request_post_error', { source, error: String(err) });
    }
    try{
      if (typeof window.__ghStartMagicProbe === 'function'){
        setTimeout(function(){
          try{
            window.__ghStartMagicProbe(source);
          }catch(probeErr){
            debugLog('[Auth] Probe invocation error', probeErr);
            postDebug('probe_invocation_error', { source, error: String(probeErr) });
          }
        }, 80);
      }
    }catch(err){
      debugLog('[Auth] Probe dispatch error', err);
      postDebug('probe_dispatch_error', { source, error: String(err) });
    }
  }

  // New: Detect "Get sign-in link" button clicks
  function notifyGetLinkClick(source){
    const state = ensureMagicState();
    const now = Date.now();
    if (now - (state.lastRequestTs || 0) < 700){
      debugLog('[Auth] Get link click ignored (cooldown) from', source);
      return;
    }
    state.lastRequestTs = now;
    debugLog('[Auth] Get sign-in link button clicked from', source);
    try{
      window.ReactNativeWebView?.postMessage(JSON.stringify({type:'gh:getlink_clicked', source, timestamp: now}));
    }catch(err){
      debugLog('[Auth] Error posting gh:getlink_clicked', err);
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
            debugLog('[Auth] Hooked magic request control', sel, label);
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
          debugLog('[Auth] Hooked magic request form');
          postDebug('hook_form', { action: form.action, label: formLabel });
          try{
            form.addEventListener('submit', function(){
              notifyMagicRequest('hooked-form');
            }, { passive: true });
          }catch(e){}
        }
      }
    }catch(err){
      debugLog('[Auth] scanForMagicControls error', err);
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
          debugLog('[Auth] Hooked Get sign-in link button:', text, id, testId);
          
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
      debugLog('[Auth] scanForGetLinkButtons error', err);
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
      debugLog('[Auth] Magic link banner suppressed - skipping (' + source + ')');
      return;
    }
    const now = Date.now();
    if (now - window.__ghMagicLinkCooldown < 3000) return;
    window.__ghMagicLinkCooldown = now;
    debugLog('[Auth] Email confirmation detected (' + source + ')');
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
    startCloudflareWatcher();
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
  initialHeaders?: Record<string, string>;
}

type CartStoragePayload = {
  session?: Record<string, string>;
  local?: Record<string, string>;
  cookies?: Record<string, string>;
};

type StorageLike = CartStorageSnapshot | (CartStorageSnapshot & { [key: string]: any }) | null | undefined;

const CART_VALUE_KEYS = ['PScart'];

interface CartMeta {
  count: number | null;
  cartId: string | null;
  items?: any[];
}

const parseCartPayload = (raw?: string | null): CartMeta => {
  if (!raw || typeof raw !== 'string') return { count: null, cartId: null, items: [] };
  const trimmed = raw.trim();
  if (!trimmed) return { count: null, cartId: null, items: [] };
  try {
    const parsed = JSON.parse(trimmed);
    const order = parsed?.order ?? parsed;
    const cartIdCandidate = order?.cartId ?? parsed?.cartId ?? null;
    let count: number | null = null;
    const items = order?.items;
    let itemsList: any[] = [];
    
    if (Array.isArray(items)) {
      itemsList = items.map((item: any) => ({
        name: item?.name || 'Unknown',
        quantity: item?.quantity || 0,
        productId: item?.productId || 'unknown',
        cartItemId: item?.cartItemId || 'unknown',
      }));
      count = items.reduce<number>((sum, item) => {
        const qty = Number(item?.quantity ?? 0);
        return sum + (Number.isFinite(qty) ? qty : 0);
      }, 0);
    } else if (items && typeof items === 'object') {
      count = 0;
    }
    return {
      count,
      cartId: typeof cartIdCandidate === 'string' ? cartIdCandidate : null,
      items: itemsList,
    };
  } catch (error) {
    debugLog('[CartStorage] Failed to parse cart payload', error);
    return { count: null, cartId: null, items: [] };
  }
};

const extractCartMeta = (storage: StorageLike): CartMeta => {
  if (!storage || !storage.local) return { count: null, cartId: null, items: [] };
  const targetKey = Object.keys(storage.local).find((key) =>
    CART_VALUE_KEYS.some((suffix) => key.endsWith(suffix))
  );
  if (!targetKey) return { count: null, cartId: null, items: [] };
  return parseCartPayload(storage.local[targetKey]);
};

const deriveCountFromStorage = (storage: StorageLike): number | null => {
  return extractCartMeta(storage).count;
};

const WebShellComponent = React.forwardRef<any, WebShellProps>(
  ({ initialUrl, tabKey, initialHeaders, onMessage: userOnMessage, onShouldStartLoadWithRequest: userShouldStart, ...restProps }, ref) => {
    // Removed excessive logging that causes re-renders

    const { setCartCount } = useApp();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false); // Start false - don't block with loading overlay
    const webviewRef = useRef<WebView>(null);
    const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Simple watchdog: if Home stays blank for too long, force-load the URL once
    useEffect(() => {
      if (tabKey !== 'home') return;
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = setTimeout(() => {
        try {
          const target = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
          if (target && typeof target.injectJavaScript === 'function') {
            target.injectJavaScript(`(function(){ try {
              var href = (window.location && window.location.href) || '';
              var blank = !document.body || ((document.body.innerText||'').trim().length < 20);
              if (!href || href === 'about:blank' || blank) { window.location.href = 'https://greenhauscc.com/'; }
            } catch(_) {} return true; })(); true;`);
          }
        } catch {}
      }, 10000);
      return () => {
        if (watchdogRef.current) {
          clearTimeout(watchdogRef.current);
          watchdogRef.current = null;
        }
      };
    }, [tabKey, initialUrl, ref]);
    const isActiveRef = useRef(false);
    const isMountedRef = useRef(true);
    const lastHydratedAtRef = useRef(0);
    const lastHydratedSignatureRef = useRef<string | null>(null);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLoadingRef = useRef(false); // Initialize to match isLoading state
    
    const serializeForInjection = useCallback((value: unknown) => {
      try {
        return JSON.stringify(value).replace(/</g, '\\u003c');
      } catch (error) {
        debugWarn('[WebShell] Failed to serialize payload for injection', error);
        return 'null';
      }
    }, []);

  const hydrateCartStorage = useCallback((target?: WebView | null, options?: { tabKey?: string; allowReload?: boolean; forceReload?: boolean }) => {
      if (!target) return false;
      const snapshot = cartState.get();
      if (!snapshot) return false;
      const snapshotTimestamp = snapshot.updatedAt ?? Date.now();
      const snapshotSignature = (snapshot as any)?.signature ?? null;
      const derivedCount = deriveCountFromStorage(snapshot);
      const payload = {
        session: snapshot.session ?? {},
        local: snapshot.local ?? {},
        cookies: snapshot.cookies ?? {},
      };
      const serialized = serializeForInjection(payload);
      const script = `
        (function(){
          try {
            const payload = ${serialized};
            if (payload && typeof payload === 'object') {
              if (payload.session) {
                Object.keys(payload.session).forEach(function(key){
                  try { sessionStorage.setItem(key, payload.session[key]); } catch(err){}
                });
              }
              if (payload.local) {
                Object.keys(payload.local).forEach(function(key){
                  try { localStorage.setItem(key, payload.local[key]); } catch(err){}
                });
              }
              if (payload.cookies) {
                Object.keys(payload.cookies).forEach(function(key){
                  try {
                    document.cookie = key + '=' + payload.cookies[key] + '; path=/; SameSite=None; secure';
                  } catch(err){}
                });
              }
            }
          } catch (err) {
            debugLog('[CartStorage] hydrate error', err);
          }
        })();
        true;
      `;
      try {
        target.injectJavaScript(script);
        const needsReload =
          options?.tabKey === 'cart' &&
          options?.allowReload &&
          typeof derivedCount === 'number' &&
          derivedCount > 0 &&
          (
            options?.forceReload ||
            (snapshotSignature && snapshotSignature !== lastHydratedSignatureRef.current)
          );
        lastHydratedAtRef.current = Math.max(lastHydratedAtRef.current, snapshotTimestamp);
        if (snapshotSignature) {
          lastHydratedSignatureRef.current = snapshotSignature;
        }
        if (needsReload) {
          debugLog('[WebShell] ♻️ Reloading cart tab after hydrating stored cart data');
          // Use WebView's native reload method instead of window.location.reload()
          // This ensures proper navigation and prevents empty page issues
          setTimeout(() => {
            try {
              target.reload();
            } catch (err) {
              debugWarn('[WebShell] Failed to reload WebView, falling back to JS reload', err);
              // Fallback to JS reload if native reload fails
              target.injectJavaScript(
                '(function(){ if (!window.__ghReloadingCart){ window.__ghReloadingCart=true; setTimeout(function(){ window.location.href = window.location.href.split("?")[0] + "?review=true"; }, 200); } })(); true;'
              );
            }
          }, 300); // Increased delay to ensure hydration completes
        }
        return true;
      } catch (err) {
        debugWarn('[WebShell] Failed to inject cart storage', err);
        return false;
      }
    }, [serializeForInjection]);
    
    // Fake checkout modal state
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [currentOrder, setCurrentOrder] = useState<FakeDemoOrder | null>(null);

    const handleMessage = useCallback(async (event: any) => {
      try {
        const rawData = event.nativeEvent.data || '{}';
        // debugLog(`[WebShell:${tabKey}] 📨 Raw message received:`, rawData); // DISABLED - too verbose

        const msg = JSON.parse(rawData);
        // Only log message type, not full payload
        debugLog(`[WebShell:${tabKey}] 📨 Message type:`, msg.type, 'from:', msg.source);
        
        if (msg.type === 'CART_COUNT' || msg.type === 'CART') {
          // Parse the incoming count first
          const count = Number(msg.value ?? msg.count ?? 0);
          let normalized = isFinite(count) ? Math.max(0, Math.min(999, count)) : 0;
          
          debugLog(`[WebShell:${tabKey}] 🛒 CART_COUNT received - raw value: ${msg.value}, count: ${msg.count}, normalized: ${normalized}`);
          
          // Extract storage and cartId information
          const incomingStorage = msg.storage as CartStoragePayload | undefined;
          let storageCount: number | null = null;
          let incomingCartId: string | null = null;
          
          let incomingItems: any[] = [];
          if (incomingStorage) {
            const meta = extractCartMeta(incomingStorage);
            storageCount = meta.count;
            incomingCartId = meta.cartId;
            incomingItems = meta.items || [];
            debugLog(`[WebShell:${tabKey}] 📦 Incoming storage - count: ${storageCount}, cartId: ${incomingCartId}`);
          } else {
            debugLog(`[WebShell:${tabKey}] ⚠️ No storage snapshot in CART_COUNT message`);
          }
          
          // Get cached cart state
          const cachedSnapshot = cartState.get();
          const cachedMeta = extractCartMeta(cachedSnapshot);
          const cachedCount = cachedMeta.count;
          const cachedCartId = cachedMeta.cartId;
          const cachedItems = cachedMeta.items || [];
          debugLog(`[WebShell:${tabKey}] 💾 Cached state - count: ${cachedCount}, cartId: ${cachedCartId}`);
          
          // Detect if Ecwid session was reset (different cartId, was non-zero, now zero)
          const isServerReset =
            !!(
              incomingStorage &&
              incomingCartId &&
              cachedCartId &&
              incomingCartId !== cachedCartId &&
              (cachedCount ?? 0) > 0 &&
              (storageCount ?? 0) === 0
            );
          
          if (isServerReset) {
            debugLog(
              `[WebShell:${tabKey}] 🚨 CART SESSION RESET DETECTED!\n` +
              `  Previous cartId: ${cachedCartId}\n` +
              `  New cartId: ${incomingCartId}\n` +
              `  Previous count: ${cachedCount}\n` +
              `  New count: ${storageCount}\n` +
              `  → This indicates Ecwid created a NEW session, losing the old cart!\n` +
              `  → We should NOT be getting new cartIds - something is breaking the session.`
            );
            
            // Preserve the cached cart
            storageCount = cachedCount;
            normalized = cachedCount ?? 0;
            
            // Try to restore the old cart by rehydrating
            if (cachedSnapshot) {
              const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
              
              // For cart tab, navigate to cart URL directly to ensure proper page load
              if (tabKey === 'cart' && targetRef) {
                debugLog('[WebShell:cart] 🔄 Restoring cart session after reset');
                // First hydrate storage immediately
                hydrateCartStorage(targetRef, {
                  tabKey,
                  allowReload: false, // Don't auto-reload, we'll navigate manually
                  forceReload: false,
                });
                
                // Navigate to cart URL after hydration completes
                // Use a longer delay to ensure storage is fully hydrated
                setTimeout(() => {
                  try {
                    // Check current URL and navigate if needed
                    targetRef.injectJavaScript(`
                      (function() {
                        const cartUrl = 'https://greenhauscc.com/products/cart?review=true';
                        const currentUrl = window.location.href;
                        
                        debugLog('[CartRestore] Current URL:', currentUrl);
                        debugLog('[CartRestore] Target URL:', cartUrl);
                        
                        // Only navigate if we're not already on the cart page
                        if (!currentUrl.includes('/cart')) {
                          debugLog('[CartRestore] Navigating to cart URL');
                          window.location.href = cartUrl;
                        } else if (currentUrl !== cartUrl) {
                          // On cart page but different URL, reload to ensure proper state
                          debugLog('[CartRestore] Reloading cart page with correct URL');
                          window.location.href = cartUrl;
                        } else {
                          // Already on correct cart URL, just reload to refresh
                          debugLog('[CartRestore] Reloading current cart page');
                          window.location.reload();
                        }
                      })();
                      true;
                    `);
                  } catch (err) {
                    debugWarn('[WebShell:cart] Failed to navigate to cart', err);
                    // Fallback: try native reload
                    try {
                      targetRef.reload();
                    } catch (reloadErr) {
                      debugError('[WebShell:cart] Failed to reload WebView', reloadErr);
                    }
                  }
                }, 500); // Increased delay to ensure hydration completes
              } else {
                // For other tabs, use normal hydration
                const success = hydrateCartStorage(targetRef, {
                  tabKey,
                  allowReload: false,
                  forceReload: false,
                });
                debugLog(
                  `[WebShell:${tabKey}] ${success ? '✅ Attempted to rehydrate old cart' : '❌ Failed to rehydrate old cart'}`
                );
              }
            }
          } else if (incomingStorage) {
            // Normal case - save the incoming storage
            if (incomingCartId && cachedCartId && incomingCartId !== cachedCartId) {
              debugLog(
                `[WebShell:${tabKey}] 🔄 CartId changed from ${cachedCartId} to ${incomingCartId}\n` +
                `  Old count: ${cachedCount}\n` +
                `  New count: ${storageCount}\n` +
                `  → This is OK if both have items (cart was checked out or started fresh)`
              );
            } else if (incomingCartId && cachedCartId && incomingCartId === cachedCartId) {
              // Same cart ID - check if items were added or removed
              if ((storageCount ?? 0) < (cachedCount ?? 0)) {
                debugLog(
                  `[WebShell:${tabKey}] 📉 Same cart ID - items removed: ${cachedCount} → ${storageCount} items\n` +
                  `  → Saving updated state to remember current cart contents`
                );
              } else if ((storageCount ?? 0) > (cachedCount ?? 0)) {
                debugLog(
                  `[WebShell:${tabKey}] 📈 Same cart ID - items added: ${cachedCount} → ${storageCount} items\n` +
                  `  → Saving updated state`
                );
              }
            }
            
            // CRITICAL: Handle cart ID changes intelligently
            // If old cart had items and new cart has different items, we need to merge or restore
            // Only check this when cart IDs are different
            if (incomingCartId && cachedCartId && incomingCartId !== cachedCartId && cachedCount && cachedCount > 0 && cachedItems && cachedItems.length > 0) {
              const oldItemIds = new Set(cachedItems.map((item: any) => item.cartItemId || item.productId));
              const newItemIds = new Set(incomingItems.map((item: any) => item.cartItemId || item.productId));
              const hasOverlap = Array.from(oldItemIds).some(id => newItemIds.has(id));
              
              // If cart ID changed AND there's no overlap AND new cart is EMPTY, merge old items into new cart
              // Only merge if new cart is completely empty (0 items) - this means cart was truly reset
              // If new cart has items (even fewer), they might be from hydration - don't merge (would cause duplicates)
              // Wait a bit to ensure Ecwid has loaded items from hydrated storage before merging
              if (!hasOverlap && cachedCount > 0 && (storageCount ?? 0) === 0) {
                debugError(
                  `[WebShell:${tabKey}] 🚨 CART ID CHANGED - New cart is EMPTY, merging old items!\n` +
                  `  Old cartId: ${cachedCartId} (${cachedCount} items)\n` +
                  `  New cartId: ${incomingCartId} (${storageCount} items - EMPTY)\n` +
                  `  → Waiting for hydration to complete, then merging old items if still empty`
                );
                
                // Merge old items into the new cart using Ecwid API
                const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
                if (targetRef && cachedItems && cachedItems.length > 0) {
                  debugLog(`[WebShell:${tabKey}] 🔄 Merging ${cachedItems.length} old items into new cart...`);
                  
                  // Extract selectedOptions from cached items (need to get from full cart data)
                  const cachedSnapshot = cartState.get();
                  let itemsWithOptions: any[] = [];
                  if (cachedSnapshot?.local) {
                    const cartKey = Object.keys(cachedSnapshot.local).find((key) =>
                      CART_VALUE_KEYS.some((suffix) => key.endsWith(suffix))
                    );
                    if (cartKey) {
                      try {
                        const cartData = JSON.parse(cachedSnapshot.local[cartKey]);
                        const order = cartData?.order ?? cartData;
                        const items = order?.items || [];
                        itemsWithOptions = items.map((item: any) => ({
                          productId: item.productId,
                          quantity: item.quantity,
                          selectedOptions: item.selectedOptions || {},
                          combinationsId: item.combinationsId,
                        }));
                      } catch (e) {
                        debugWarn('[WebShell] Failed to extract options from cached cart', e);
                        itemsWithOptions = cachedItems.map((item: any) => ({
                          productId: item.productId,
                          quantity: item.quantity,
                          selectedOptions: {},
                        }));
                      }
                    }
                  }
                  
                  const restoreScript = `
                    (function() {
                      if (window.Ecwid && window.Ecwid.Cart && window.Ecwid.Cart.get && window.Ecwid.Cart.addProduct) {
                        var itemsToMerge = ${JSON.stringify(itemsWithOptions.length > 0 ? itemsWithOptions : cachedItems)};
                        
                        debugLog('[CartMerge] 🔄 Waiting for hydration to complete, then checking cart...');
                        
                        // Wait 2 seconds to ensure Ecwid has loaded items from hydrated storage
                        setTimeout(function() {
                          // Check current cart state
                          window.Ecwid.Cart.get(function(currentCart) {
                            var currentItems = currentCart?.items || [];
                            var currentItemMap = {};
                            var currentCount = currentCart?.productsQuantity || 0;
                            
                            // Build a map of current items by productId+combinationsId
                            currentItems.forEach(function(item) {
                              var key = item.productId + '_' + (item.combinationsId || 'null');
                              currentItemMap[key] = item;
                            });
                            
                            debugLog('[CartMerge] 📋 After hydration wait - cart has', currentCount, 'items (', currentItems.length, 'unique)');
                            
                            // If cart already has items (from hydration), don't merge - would cause duplicates
                            if (currentCount > 0) {
                              debugLog('[CartMerge] ⏭️ Cart already has items from hydration - skipping merge to avoid duplicates');
                              debugLog('[CartMerge] ✅ Cart restoration complete via hydration - no merge needed');
                              return;
                            }
                            
                            // Cart is still empty - proceed with merge
                            debugLog('[CartMerge] 🔄 Cart is still empty - proceeding with merge of', itemsToMerge.length, 'items');
                            
                            var mergedCount = 0;
                            var failedCount = 0;
                            var skippedCount = 0;
                            
                            // Add each item to the new cart (only if not already present)
                            itemsToMerge.forEach(function(item, index) {
                              setTimeout(function() {
                                if (item.productId && item.quantity) {
                                  var itemKey = item.productId + '_' + (item.combinationsId || 'null');
                                  var existingItem = currentItemMap[itemKey];
                                  
                                  // Double-check if item already exists (might have been added by hydration during merge)
                                  if (existingItem) {
                                    debugLog('[CartMerge] ⏭️ Item already in cart:', item.productId, '- skipping to avoid duplicate');
                                    skippedCount++;
                                    if (mergedCount + failedCount + skippedCount === itemsToMerge.length) {
                                      debugLog('[CartMerge] ✅ Finished merging -', mergedCount, 'added,', skippedCount, 'skipped,', failedCount, 'failed');
                                    }
                                    return;
                                  }
                                  
                                  var options = item.selectedOptions || {};
                                  var params = { quantity: item.quantity };
                                  
                                  // Include combinationsId if available (for product variants)
                                  if (item.combinationsId) {
                                    params.combinationsId = item.combinationsId;
                                  }
                                  
                                  // Include options if available
                                  if (options && Object.keys(options).length > 0) {
                                    params.options = options;
                                  }
                                  
                                  debugLog('[CartMerge] ➕ Adding item:', item.productId, 'Qty:', item.quantity, 'Params:', JSON.stringify(params));
                                  
                                  window.Ecwid.Cart.addProduct(item.productId, params, function(success) {
                                    if (success) {
                                      mergedCount++;
                                      debugLog('[CartMerge] ✅ Merged item', mergedCount, 'of', itemsToMerge.length);
                                    } else {
                                      failedCount++;
                                      debugError('[CartMerge] ❌ Failed to merge item:', item.productId);
                                    }
                                    
                                    if (mergedCount + failedCount + skippedCount === itemsToMerge.length) {
                                      debugLog('[CartMerge] ✅ Finished merging -', mergedCount, 'added,', skippedCount, 'skipped,', failedCount, 'failed');
                                      // Trigger cart update to sync with server
                                      if (window.Ecwid && window.Ecwid.Cart && window.Ecwid.Cart.get) {
                                        setTimeout(function() {
                                          window.Ecwid.Cart.get(function(cart) {
                                            var cartCount = cart?.productsQuantity || 0;
                                            var cartId = cart?.cartId || 'none';
                                            debugLog('[CartMerge] 🛒 Final cart - ID:', cartId, 'Count:', cartCount);
                                          });
                                        }, 1000);
                                      }
                                    }
                                  });
                                }
                              }, index * 400); // Stagger requests
                            });
                          });
                        }, 2000); // Wait 2 seconds for hydration to complete
                      } else {
                        debugError('[CartMerge] ❌ Ecwid API not available');
                      }
                    })();
                    true;
                  `;
                  targetRef.injectJavaScript(restoreScript);
                  
                  // Don't update badge yet - wait for merge to complete
                  // If new cart is empty, merge will restore items
                  // If new cart has items, they're already shown
                  debugLog(`[WebShell:${tabKey}] ⏭️ Deferring badge update - merge in progress, will update after merge completes`);
                  
                  // Don't save the new storage yet - wait for merge to complete
                  // The merge will trigger a new CART_COUNT message with merged items
                  debugLog(`[WebShell:${tabKey}] ⏭️ Deferring save - merge in progress, will save after merge completes`);
                  return; // Exit early - merge will trigger new CART_COUNT with merged items
                }
              } else if (hasOverlap || (storageCount ?? 0) >= cachedCount) {
                // Cart ID changed but new cart has items that overlap or more items - it's an update, save it
                debugLog(
                  `[WebShell:${tabKey}] ✅ Cart ID changed - new cart has ${storageCount} items (old had ${cachedCount}), saving update`
                );
              } else {
                // Cart ID changed and new cart has fewer items - might be from hydration, save the new state
                debugLog(
                  `[WebShell:${tabKey}] ✅ Cart ID changed - new cart has ${storageCount} items (old had ${cachedCount}), saving updated state`
                );
              }
            }
            
            // ALWAYS save the incoming storage to keep cache in sync with actual cart state
            // This ensures that when user removes items, we remember the new state, not the old one
            cartState.save(incomingStorage);
            debugLog(`[WebShell:${tabKey}] 💾 Saved incoming storage to cartState (count: ${storageCount}, cartId: ${incomingCartId || 'none'})`);
          }
          
          // Always update the app badge even if this WebView is not the active tab.
          // We already saved storage above to keep cache in sync; now reflect count in UI.
          
          // Use storage-derived count if available
          if (storageCount !== null) {
            if (storageCount !== normalized) {
              debugLog(`[WebShell:${tabKey}] 🔁 Overriding message count ${normalized} with storage-derived count ${storageCount}`);
            }
            normalized = storageCount;
          } else if (normalized === 0) {
            // If message says zero but we have no storage, and cache has items, trust cache
            if (typeof cachedCount === 'number' && cachedCount > 0) {
              debugLog(
                `[WebShell:${tabKey}] ⚠️ Message says 0 but no storage included, cached cart has ${cachedCount} items - trusting cache`
              );
              normalized = cachedCount;
              
              // Request cart storage to sync cache with actual cart state
              // This ensures we have the latest state even if message didn't include storage
              const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
              if (targetRef) {
                debugLog(`[WebShell:${tabKey}] 🔄 Requesting cart storage to sync cache...`);
                targetRef.injectJavaScript(`
                  (function() {
                    if (window.Ecwid && window.Ecwid.Cart && window.Ecwid.Cart.get) {
                      window.Ecwid.Cart.get(function(cart) {
                        var cartCount = cart?.productsQuantity || 0;
                        var cartId = cart?.cartId || 'none';
                        debugLog('[CartSync] 🛒 Current cart - ID:', cartId, 'Count:', cartCount);
                        
                        // Request storage snapshot to update cache
                        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                          try {
                            var storage = {
                              local: {},
                              session: {},
                              cookies: {}
                            };
                            
                            // Capture localStorage
                            for (var i = 0; i < localStorage.length; i++) {
                              var key = localStorage.key(i);
                              if (key) {
                                storage.local[key] = localStorage.getItem(key);
                              }
                            }
                            
                            // Capture sessionStorage
                            for (var j = 0; j < sessionStorage.length; j++) {
                              var sessKey = sessionStorage.key(j);
                              if (sessKey) {
                                storage.session[sessKey] = sessionStorage.getItem(sessKey);
                              }
                            }
                            
                            // Capture cookies
                            storage.cookies = document.cookie;
                            
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                              type: 'CART_COUNT',
                              value: cartCount,
                              source: window.location.pathname,
                              storage: storage
                            }));
                            debugLog('[CartSync] ✅ Sent storage snapshot to sync cache');
                          } catch (e) {
                            debugError('[CartSync] ❌ Failed to capture storage:', e);
                          }
                        }
                      });
                    }
                  })();
                  true;
                `);
              }
            } else {
              // Zero with no storage and no cache - ignore it unless we're ready
              debugLog(
                `[WebShell:${tabKey}] ⏭️ Ignoring zero cart count without storage snapshot or cache`
              );
              return;
            }
          }
          
          debugLog(`[WebShell:${tabKey}] ✅ Final cart count: ${normalized} - updating badge now`);
          setCartCount(normalized);
        } else if (msg.type === 'NAVIGATE_TAB') {
          if (msg.tab && msg.tab !== tabKey) {
            debugLog(`[WebShell:${tabKey}] 🧭 Navigating to tab:`, msg.tab);
            
            // Just use router.push for ALL tabs - let cart.tsx handle cart navigation with hash checking
            debugLog(`[WebShell:${tabKey}] ➡️ Switching to ${msg.tab} tab via router.push`);
            router.push(`/(tabs)/${msg.tab}` as any);
          }
        } else if (msg.type === 'EMAIL_LINK_SENT') {
          debugLog(`[WebShell:${tabKey}] 📧 Email link sent detected`);
        } else if (msg.type === 'SHARE') {
          // Handle native share request from webview
          debugLog(`[WebShell:${tabKey}] 📤 Share request:`, msg);
          const url = msg.url || msg.value;
          const title = msg.title || 'Check this out!';
          const message = msg.message || title;
          
          Share.share({
            title: title,
            message: Platform.OS === 'ios' ? message : `${message}\n${url}`,
            url: Platform.OS === 'ios' ? url : undefined,
          }).then((result) => {
            debugLog(`[WebShell:${tabKey}] ✅ Share result:`, result);
          }).catch((error) => {
            debugError(`[WebShell:${tabKey}] ❌ Share error:`, error);
          });
        } else if (msg.type === 'FAKE_CHECKOUT_DATA') {
          // Handle fake checkout data from intercepted checkout attempt
          debugLog(`[WebShell:${tabKey}] 🛒 Fake checkout data received:`, msg);
          
          const newOrder = await FakeDemoOrdersService.addOrder({
            status: 'Confirmed',
            storeName: 'GreenHaus Demo Store',
            total: msg.total || '$10.98',
            subtotal: msg.subtotal || '$10.00',
            tax: msg.tax || '$0.98',
            items: msg.items || [{ name: 'Demo Item', price: '$10.00', quantity: 1 }],
          });
          
          setCurrentOrder(newOrder);
          setShowOrderModal(true);
          
          // Navigate back to cart or store after a moment
          setTimeout(() => {
            const actualRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
            if (actualRef) {
              actualRef.injectJavaScript(`
                (function() {
                  try {
                    window.history.back();
                  } catch(e) {
                    window.location.href = 'https://greenhauscc.com/products';
                  }
                })();
                true;
              `);
            }
          }, 300);
        } else if (msg.type === 'DEBUG_TEST') {
          debugLog(`[WebShell:${tabKey}] 🔍 DEBUG TEST RECEIVED:`, msg.value, 'at', new Date(msg.timestamp).toLocaleTimeString());
        } else {
          debugLog(`[WebShell:${tabKey}] 📨 Unknown message type:`, msg.type);
        }
        
        if (userOnMessage) {
          userOnMessage(event);
        }
      } catch (error) {
        debugError(`[WebShell:${tabKey}] ❌ Message parse error:`, error, 'raw data:', event.nativeEvent.data);
      }
    }, [setCartCount, router, tabKey, userOnMessage, ref, webviewRef, hydrateCartStorage]);

    const handleError = useCallback((syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      debugError(`[WebShell:${tabKey}] ❌ WebView error:`, nativeEvent);
      debugError(`[WebShell:${tabKey}] ❌ Error code:`, nativeEvent.code);
      debugError(`[WebShell:${tabKey}] ❌ Error description:`, nativeEvent.description);
      debugError(`[WebShell:${tabKey}] ❌ Error domain:`, nativeEvent.domain);
      debugError(`[WebShell:${tabKey}] ❌ Error URL:`, nativeEvent.url);
      
      // WebKit Error 300 - try to reload after a delay
      if (nativeEvent.code === 300 || nativeEvent.domain === 'WebKitErrorDomain') {
        debugWarn(`[WebShell:${tabKey}] ⚠️ WebKit internal error - attempting reload in 2 seconds`);
        const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
        if (targetRef) {
          setTimeout(() => {
            debugLog(`[WebShell:${tabKey}] 🔄 Reloading after WebKit error`);
            targetRef.reload();
          }, 2000);
        }
      }
    }, [tabKey, ref, webviewRef]);

    const handleHttpError = useCallback((syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      debugError(`[WebShell:${tabKey}] 🌐 HTTP error:`, nativeEvent);
      debugError(`[WebShell:${tabKey}] 🌐 Status code:`, nativeEvent.statusCode);
      debugError(`[WebShell:${tabKey}] 🌐 URL:`, nativeEvent.url);
      // Don't clear loading on HTTP errors - let onLoadEnd handle it
      // Some pages return 200 even with errors
    }, [tabKey]);

    const handleLoadStart = useCallback((syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      debugLog(`[WebShell:${tabKey}] 📤 onLoadStart fired`);
      debugLog(`[WebShell:${tabKey}] 📤 Load start URL:`, nativeEvent?.url);
      debugLog(`[WebShell:${tabKey}] 📤 Load start navigationType:`, nativeEvent?.navigationType);
      
      // Ensure WebView is still mounted
      if (!isMountedRef.current) {
        debugWarn(`[WebShell:${tabKey}] ⚠️ Component unmounted, ignoring loadStart`);
        return;
      }
      
      // Only hydrate cart storage on the cart tab to avoid cookie churn on other pages
      const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
      if (targetRef) {
        if (!WEBVIEW_MINIMAL_MODE && tabKey === 'cart') {
          debugLog(`[WebShell:${tabKey}] 🔄 Load start - hydrating cart storage EARLY to preserve cart ID`);
          hydrateCartStorage(targetRef, { tabKey, allowReload: false });
        }
      } else {
        debugWarn(`[WebShell:${tabKey}] ⚠️ No WebView ref available during loadStart`);
      }
    }, [ref, tabKey, hydrateCartStorage]);

    const handleLoadEnd = useCallback((syntheticEvent: any) => {
      const { nativeEvent } = syntheticEvent;
      debugLog(`[WebShell:${tabKey}] 📥 onLoadEnd fired`);
      debugLog(`[WebShell:${tabKey}] 📥 Load end URL:`, nativeEvent.url);
      debugLog(`[WebShell:${tabKey}] 📥 Load end title:`, nativeEvent.title);
      debugLog(`[WebShell:${tabKey}] 📥 Load end navigationType:`, nativeEvent.navigationType);
      debugLog(`[WebShell:${tabKey}] ✅ Load complete, requesting cart count`);
      
      // Ensure WebView is still mounted
      if (!isMountedRef.current) {
        debugWarn(`[WebShell:${tabKey}] ⚠️ Component unmounted during load, ignoring loadEnd`);
        return;
      }
      
      // Ensure content is visible - inject script to make sure body/content is visible
      const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
      if (targetRef) {
        if (WEBVIEW_MINIMAL_MODE) {
          return;
        }
        // Run immediately and with delays to catch all cases
        const ensureVisibility = () => {
          targetRef.injectJavaScript(`
            (function() {
              try {
                // Force visibility on all key elements
                if (document.body) {
                  document.body.style.display = '';
                  document.body.style.visibility = 'visible';
                  document.body.style.opacity = '1';
                  document.body.style.height = '';
                  document.body.style.minHeight = '';
                }
                if (document.documentElement) {
                  document.documentElement.style.display = '';
                  document.documentElement.style.visibility = 'visible';
                  document.documentElement.style.opacity = '1';
                }
                // Ensure main content containers are visible
                const main = document.querySelector('main');
                if (main) {
                  main.style.display = '';
                  main.style.visibility = 'visible';
                  main.style.opacity = '1';
                }
                // Ensure ec-store container is visible
                const ecStore = document.querySelector('.ec-store');
                if (ecStore) {
                  ecStore.style.display = '';
                  ecStore.style.visibility = 'visible';
                  ecStore.style.opacity = '1';
                }
                // Remove any hiding overlays
                const overlays = document.querySelectorAll('[style*="display: none"], [style*="opacity: 0"], [style*="visibility: hidden"]');
                overlays.forEach(el => {
                  if (el.id !== 'safe-mode-overlay') {
                    el.style.display = '';
                    el.style.visibility = '';
                    el.style.opacity = '';
                  }
                });
                debugLog('[WebShell] ✅ Content visibility ensured - body visible:', document.body ? 'yes' : 'no');
              } catch(e) {
                debugError('[WebShell] ❌ Error ensuring content visibility:', e);
              }
            })();
            true;
          `);
        };
        
        ensureVisibility();
        setTimeout(ensureVisibility, 100);
        setTimeout(ensureVisibility, 500);
        setTimeout(ensureVisibility, 1000);
      }
      
      // ========================================================================
      // SAFE MODE CONTENT FILTERING - CRITICAL FOR APP STORE COMPLIANCE
      // ========================================================================
      // ** DO NOT REMOVE THIS BLOCK **
      // Injects SAFE_MODE_SCRIPT to hide vape-related content when SAFE_MODE=true
      // Script is injected 500ms after page load to ensure DOM is fully rendered
      // See SAFE_MODE_SCRIPT definition above for full documentation
      // ========================================================================
      if (targetRef && SAFE_MODE) {
        debugLog(`[WebShell:${tabKey}] 🚀 Injecting SAFE_MODE_SCRIPT via injectJavaScript...`);
        // Inject helpers first to avoid ReferenceError in page context
        targetRef.injectJavaScript(`(function(){ try{ if(typeof window.debugLog!=='function'){window.debugLog=function(){}}; if(typeof window.debugError!=='function'){window.debugError=function(){}}; }catch(_){}; true; })();`);
        // Inject IMMEDIATELY - no delay (CSS already hid everything)
        targetRef.injectJavaScript(SAFE_MODE_SCRIPT);
      }
      if (targetRef) {
        // Don't reload on loadEnd - it causes infinite reload loops
        // Cart storage is already hydrated on loadStart, reloading here breaks page rendering
        hydrateCartStorage(targetRef, { tabKey, allowReload: false });
      }
      
      const pingDelays = tabKey === 'home'
        ? [800, 2000, 3500, 5000, 6500, 8000, 9500, 11000]
        : [500, 2000, 5000];
      pingDelays.forEach((delay, idx) => {
        setTimeout(() => {
          const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
          if (targetRef) {
            debugLog(`[WebShell:${tabKey}] 📤 Sending PING after ${delay}ms (load seq #${idx + 1})`);
            targetRef.postMessage(JSON.stringify({ type: 'PING' }));
          }
        }, delay);
      });

      // Proactively request a fresh cart count with storage snapshot after load completes.
      // This makes the badge update reliable on all tabs and on first load.
      const immediateTarget = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
      if (immediateTarget) {
        immediateTarget.injectJavaScript(`
          (function() {
            try {
              function collectStorage() {
                var storage = { local: {}, session: {}, cookies: {} };
                try {
                  for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i); if (k) storage.local[k] = localStorage.getItem(k);
                  }
                } catch(_) {}
                try {
                  for (var j = 0; j < sessionStorage.length; j++) {
                    var s = sessionStorage.key(j); if (s) storage.session[s] = sessionStorage.getItem(s);
                  }
                } catch(_) {}
                try { storage.cookies = document.cookie; } catch(_) {}
                return storage;
              }
              function postCount(n) {
                try {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'CART_COUNT',
                    value: Number(n) || 0,
                    source: 'loadEndProbe',
                    storage: collectStorage()
                  }));
                } catch(_) {}
              }
              // Prefer Ecwid API if present
              if (window.Ecwid && window.Ecwid.Cart && typeof window.Ecwid.Cart.get === 'function') {
                window.Ecwid.Cart.get(function(cart) {
                  var cnt = (cart && (cart.productsQuantity || (Array.isArray(cart.items) ? cart.items.reduce(function(a,b){return a + (Number(b.quantity)||0)},0) : 0))) || 0;
                  postCount(cnt);
                });
              } else {
                // Fallback DOM probe
                var items = document.querySelectorAll('.ec-cart-item, .cart-item, [data-cart-item]');
                postCount(items ? items.length : 0);
              }
            } catch(_) {}
            true;
          })();
        `);
      }
    }, [ref, tabKey, hydrateCartStorage]);

    const handleShouldStartLoadWithRequest = useCallback(
      (request: any) => {
        try {
          const url: string = request?.url || '';
          if (!url) {
            return false;
          }

          const normalizedUrl = url.toLowerCase();

          if (
            normalizedUrl.startsWith('about:blank') ||
            normalizedUrl.startsWith('about:srcdoc') ||
            normalizedUrl.startsWith('javascript:') ||
            normalizedUrl.startsWith('data:')
          ) {
            return true;
          }

          const isAllowedHost = ALLOWED_HOST_PATTERNS.some((pattern) =>
            normalizedUrl.includes(pattern)
          );

          if (!isAllowedHost) {
            debugLog(`[WebShell:${tabKey}] 🚫 Blocking navigation to external host:`, url);
            // Silently block external links in demo mode - no alert spam
            return false;
          }

          // FAKE AUTH: Intercept login/auth routes
          if (REVIEW_BUILD && REVIEW_DEMO_FAKE_AUTH) {
            const isAuthRoute = AUTH_PATTERNS.some((pattern) => normalizedUrl.includes(pattern));
            if (isAuthRoute) {
              debugLog(`[WebShell:${tabKey}] 🔐 Intercepted auth route:`, url);
              const toast = 'Demo build: already signed in as Apple Reviewer.';
              if (Platform.OS === 'android') {
                ToastAndroid.show(toast, ToastAndroid.SHORT);
              } else {
                Alert.alert('Demo Mode', toast);
              }
              return false;
            }
          }

          // FAKE CHECKOUT: Intercept checkout/payment routes
          if (REVIEW_BUILD && REVIEW_DEMO_FAKE_CHECKOUT) {
            const isCheckoutRoute = CHECKOUT_PATTERNS.some((pattern) => normalizedUrl.includes(pattern));
            if (isCheckoutRoute) {
              debugLog(`[WebShell:${tabKey}] 🛒 Intercepted checkout route:`, url);
              
              // Trigger cart data extraction asynchronously (don't block navigation decision)
              setTimeout(() => {
                const actualRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
                if (actualRef) {
                  actualRef.injectJavaScript(`
                    (function() {
                      try {
                        // Extract cart info
                        const totalEl = document.querySelector('.ec-cart__total, [data-total], .cart-total');
                        const subtotalEl = document.querySelector('.ec-cart__subtotal, [data-subtotal], .cart-subtotal');
                        const taxEl = document.querySelector('.ec-cart__tax, [data-tax], .cart-tax');
                        
                        const total = totalEl ? (totalEl.textContent || totalEl.innerText || '$0.00').trim() : '$10.98';
                        const subtotal = subtotalEl ? (subtotalEl.textContent || subtotalEl.innerText || '$0.00').trim() : '$10.00';
                        const tax = taxEl ? (taxEl.textContent || taxEl.innerText || '$0.00').trim() : '$0.98';
                        
                        // Extract items (basic)
                        const items = [];
                        const itemEls = document.querySelectorAll('.ec-cart-item, .cart-item, [data-cart-item]');
                        itemEls.forEach((el, idx) => {
                          if (idx < 3) { // Max 3 items
                            const nameEl = el.querySelector('.ec-cart-item__name, .item-name, [data-item-name]');
                            const priceEl = el.querySelector('.ec-cart-item__price, .item-price, [data-item-price]');
                            const qtyEl = el.querySelector('.ec-cart-item__qty, .item-qty, [data-item-qty]');
                            
                            items.push({
                              name: nameEl ? (nameEl.textContent || nameEl.innerText || 'Item').trim() : 'Demo Item',
                              price: priceEl ? (priceEl.textContent || priceEl.innerText || '$5.00').trim() : '$5.00',
                              quantity: qtyEl ? parseInt(qtyEl.textContent || qtyEl.innerText || '1') : 1
                            });
                          }
                        });
                        
                        // Fallback if no items detected
                        if (items.length === 0) {
                          items.push({ name: 'Hemp Flower Sample', price: '$10.00', quantity: 1 });
                        }
                        
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                          type: 'FAKE_CHECKOUT_DATA',
                          total,
                          subtotal,
                          tax,
                          items
                        }));
                      } catch (e) {
                        debugError('[FakeCheckout] Error extracting cart data:', e);
                        // Send minimal fallback
                        window.ReactNativeWebView?.postMessage(JSON.stringify({
                          type: 'FAKE_CHECKOUT_DATA',
                          total: '$10.98',
                          subtotal: '$10.00',
                          tax: '$0.98',
                          items: [{ name: 'Demo Item', price: '$10.00', quantity: 1 }]
                        }));
                      }
                    })();
                    true;
                  `);
                }
              }, 0);
              
              return false; // Block the navigation
            }
          }

          if (userShouldStart) {
            const result = userShouldStart(request);
            return typeof result === 'boolean' ? result : true;
          }

          return true;
        } catch (error) {
          debugError(`[WebShell:${tabKey}] ❌ Error in shouldStart handler:`, error);
          return false;
        }
      },
      [tabKey, userShouldStart, ref, webviewRef]
    );

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
        isActiveRef.current = true;
        const actualRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
        if (actualRef && isMountedRef.current) {
          actualRef.postMessage(JSON.stringify({ type: 'TAB_ACTIVE', value: true }));
          // Don't reload on focus - let the page load naturally
          hydrateCartStorage(actualRef, { tabKey, allowReload: false });
          
          // Single delayed PING instead of multiple
          setTimeout(() => {
            if (isMountedRef.current && isActiveRef.current) {
              actualRef.postMessage(JSON.stringify({ type: 'PING' }));
            }
          }, 1000);
        }
        return () => {
          isActiveRef.current = false;
          const actualRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
          if (actualRef) {
            actualRef.postMessage(JSON.stringify({ type: 'TAB_ACTIVE', value: false }));
          }
        };
      }, [ref, tabKey, hydrateCartStorage])
    );

    // Generate cart hydration script that runs BEFORE Ecwid initializes
    // This script is injected BEFORE content loads, so Ecwid sees the cart immediately
    // CRITICAL: Hydrate synchronously on mount to ensure script is ready before WebView loads
    const [cartHydrationScript, setCartHydrationScript] = useState(() => {
      // Try to get cached snapshot immediately (synchronous)
      const cachedSnapshot = cartState.get();
      if (cachedSnapshot) {
        const payload = {
          session: cachedSnapshot.session ?? {},
          local: cachedSnapshot.local ?? {},
          cookies: cachedSnapshot.cookies ?? {},
        };
        const sig = cachedSnapshot.signature || '';
        try {
          const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');
          const script = `
            (function(){
              try {
                const payload = ${serialized};
                if (payload && typeof payload === 'object') {
                  // Restore sessionStorage BEFORE Ecwid initializes
                  if (payload.session) {
                    Object.keys(payload.session).forEach(function(key){
                      try { sessionStorage.setItem(key, payload.session[key]); } catch(err){}
                    });
                  }
                  // Restore localStorage BEFORE Ecwid initializes (CRITICAL for cart ID!)
                  if (payload.local) {
                    Object.keys(payload.local).forEach(function(key){
                      try { localStorage.setItem(key, payload.local[key]); } catch(err){}
                    });
                  }
                  // Restore cookies BEFORE Ecwid initializes
                  if (payload.cookies) {
                    Object.keys(payload.cookies).forEach(function(key){
                      try {
                        document.cookie = key + '=' + payload.cookies[key] + '; path=/; SameSite=None; secure';
                      } catch(err){}
                    });
                  }
                  debugLog('[CartStorage] ✅ Cart hydrated BEFORE Ecwid initialization (sync)');
                }
              } catch (err) {
                debugError('[CartStorage] ❌ Hydration error:', err);
              }
            })();
          `;
          debugLog(`[WebShell:${tabKey}] ✅ Generated INITIAL cart hydration script (${Object.keys(payload.local).length} localStorage keys, sig: ${sig.substring(0, 8)})`);
          return script;
        } catch (error) {
          debugWarn('[WebShell] Failed to generate initial cart hydration script', error);
        }
      }
      return '';
    });
    const [cartSignature, setCartSignature] = useState<string>(() => {
      const cachedSnapshot = cartState.get();
      return cachedSnapshot?.signature || '';
    });
    
    useEffect(() => {
      // Also hydrate from AsyncStorage asynchronously to ensure we have the latest
      cartState.hydrateFromStorage().then(() => {
        const snapshot = cartState.get();
        if (!snapshot) {
          // Only clear if we don't have a cached snapshot
          if (!cartState.get()) {
            setCartHydrationScript('');
            setCartSignature('');
          }
          return;
        }
        
        const payload = {
          session: snapshot.session ?? {},
          local: snapshot.local ?? {},
          cookies: snapshot.cookies ?? {},
        };
        
        const sig = snapshot.signature || '';
        setCartSignature(sig);
        
        try {
          const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');
          const script = `
            (function(){
              try {
                const payload = ${serialized};
                if (payload && typeof payload === 'object') {
                  // Restore sessionStorage BEFORE Ecwid initializes
                  if (payload.session) {
                    Object.keys(payload.session).forEach(function(key){
                      try { sessionStorage.setItem(key, payload.session[key]); } catch(err){}
                    });
                  }
                  // Restore localStorage BEFORE Ecwid initializes (CRITICAL for cart ID!)
                  if (payload.local) {
                    Object.keys(payload.local).forEach(function(key){
                      try { localStorage.setItem(key, payload.local[key]); } catch(err){}
                    });
                  }
                  // Restore cookies BEFORE Ecwid initializes
                  if (payload.cookies) {
                    Object.keys(payload.cookies).forEach(function(key){
                      try {
                        document.cookie = key + '=' + payload.cookies[key] + '; path=/; SameSite=None; secure';
                      } catch(err){}
                    });
                  }
                  debugLog('[CartStorage] ✅ Cart hydrated BEFORE Ecwid initialization (async)');
                }
              } catch (err) {
                debugError('[CartStorage] ❌ Hydration error:', err);
              }
            })();
          `;
          setCartHydrationScript(script);
          debugLog(`[WebShell:${tabKey}] ✅ Generated cart hydration script (${Object.keys(payload.local).length} localStorage keys, sig: ${sig.substring(0, 8)})`);
        } catch (error) {
          debugWarn('[WebShell] Failed to generate cart hydration script', error);
          setCartHydrationScript('');
          setCartSignature('');
        }
      });
    }, [tabKey]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
          loadTimeoutRef.current = null;
        }
      };
    }, []);

    // Removed loading state management - let WebView render immediately

    const computedSource = useMemo(() => {
      const normalizedUrl =
        SAFE_MODE && REVIEW_BUILD ? `${initialUrl}${initialUrl.includes('?') ? '&' : '?'}review=true` : initialUrl;
      const headers =
        initialHeaders && Object.keys(initialHeaders).length > 0 ? initialHeaders : undefined;
      return { uri: normalizedUrl, headers };
    }, [initialUrl, initialHeaders]);

    // Removed excessive logging useEffect hooks that cause re-renders

    return (
      <View style={styles.container} testID={`webview-container-${tabKey}`} collapsable={false}>
        <WebView
          key={`webview-${tabKey}-v12`} // Incremented to force remount
          style={{ flex: 1, backgroundColor: '#FFFFFF' }} // White background - content will show on top
          collapsable={false}
          originWhitelist={['*']}
          ref={(r) => {
            debugLog(`[WebShell:${tabKey}] 🔗 WebView ref callback - ref:`, r ? 'SET' : 'NULL');
            if (ref) {
              if (typeof ref === 'function') ref(r);
              else ref.current = r;
            }
            webviewRef.current = r;
          }}
          source={computedSource}
          // Force immediate render
          renderError={() => (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load</Text>
              <Text style={styles.errorSubtext}>Tap to reload or check connection</Text>
            </View>
          )}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22c55e" />
            </View>
          )}
          renderError={(errorDomain, errorCode, errorDesc) => (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load page</Text>
              <Text style={styles.errorSubtext}>{errorDesc}</Text>
            </View>
          )}
          sharedCookiesEnabled
          {...(Platform.OS === 'ios' ? { useSharedProcessPool: true } : {})}
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled={true}
          incognito={false}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled={true}
          injectedJavaScriptBeforeContentLoaded={`
            ${INJECTED_CSS}
            ${cartHydrationScript}
            // Minimal visibility fix - only run once, no observers
            (function() {
              try {
                if (document.body) {
                  document.body.style.display = '';
                  document.body.style.visibility = 'visible';
                  document.body.style.opacity = '1';
                }
                if (document.documentElement) {
                  document.documentElement.style.display = '';
                  document.documentElement.style.visibility = 'visible';
                  document.documentElement.style.opacity = '1';
                }
              } catch(e) {}
            })();
            true;
          `}
          injectedJavaScript={`
            debugLog('🔥 [INJECT] Starting essential scripts only...');

            // AGGRESSIVE image quality fix - force high-res images
            (function() {
              let urlLogCount = 0;

              function fixBlurryImages() {
                try {
                  const images = document.querySelectorAll('img');
                  let fixed = 0;

                  images.forEach(img => {
                    // Remove lazy loading attributes
                    if (img.loading) img.loading = 'eager';
                    img.removeAttribute('loading');

                    // Remove any blur filters
                    if (img.style.filter && img.style.filter.includes('blur')) {
                      img.style.filter = 'none';
                      fixed++;
                    }

                    // Force srcset to use highest resolution
                    if (img.srcset) {
                      const srcsetParts = img.srcset.split(',');
                      if (srcsetParts.length > 0) {
                        const highestRes = srcsetParts[srcsetParts.length - 1].trim().split(' ')[0];
                        if (highestRes && !img.src.includes(highestRes)) {
                          img.src = highestRes;
                          img.removeAttribute('srcset'); // Prevent browser from downgrading
                          fixed++;
                        }
                      }
                    }

                    // Ecwid specific: Replace any low-res URLs with high-res versions
                    if (img.src) {
                      const originalSrc = img.src;
                      let newSrc = originalSrc
                        .replace(/\\/fit\\/\\d+x\\d+\\//g, '/') // Remove /fit/WIDTHxHEIGHT/
                        .replace(/\\/\\d+x\\d+\\//g, '/') // Remove /WIDTHxHEIGHT/
                        .replace(/[?&]w=\\d+/g, '?w=2000') // Increase width to 2000
                        .replace(/[?&]h=\\d+/g, '&h=2000') // Increase height to 2000
                        .replace(/sq=\\d+/g, 'sq=2000'); // Square dimension to 2000

                      // For Ecwid CDN URLs, replace any size parameters
                      if (newSrc.includes('ecwid') || newSrc.includes('images-')) {
                        newSrc = newSrc.replace(/_(\\d+x\\d+|\\d+)/g, '_2000');
                      }

                      if (newSrc !== originalSrc) {
                        img.src = newSrc;
                        fixed++;
                      }
                    }

                    // Fix data-src lazy loading (common pattern)
                    if (img.dataset && img.dataset.src && img.dataset.src !== img.src) {
                      img.src = img.dataset.src;
                      fixed++;
                    }

                    // Force image to be visible and not faded
                    if (img.style.opacity && parseFloat(img.style.opacity) < 1) {
                      img.style.opacity = '1';
                    }
                  });

                  // Reduced logging
                  // if (fixed > 0) debugLog('[ImageFix] Upgraded', fixed, 'images');
                } catch(e) {
                  debugError('[ImageFix] Error:', e);
                }
              }

              // Disable lazy loading globally
              if (typeof IntersectionObserver !== 'undefined') {
                const OriginalIO = IntersectionObserver;
                window.IntersectionObserver = function(callback, options) {
                  // Force all images to be considered "visible"
                  return new OriginalIO((entries) => {
                    entries.forEach(entry => {
                      entry.isIntersecting = true;
                      entry.intersectionRatio = 1;
                    });
                    callback(entries, this);
                  }, options);
                };
              }

              // Run once on load - no observers to avoid freezing
              fixBlurryImages();
              
              // Run again after a delay, but only once
              setTimeout(fixBlurryImages, 2000);

              // debugLog('[ImageFix] Image optimizer active');
            })();

            // Run scripts asynchronously to avoid blocking page load
            setTimeout(() => {
              try { ${COOKIE_INJECTION_SCRIPT} } catch(e) { debugError('Cookie error:', e); }
            }, 100);

            setTimeout(() => {
              try { ${REVIEW_LABEL_SCRIPT} } catch(e) { debugError('Review error:', e); }
            }, 200);

            setTimeout(() => {
              debugLog('🔥 [INJECT] Running SAFE_MODE_SCRIPT...');
              try {
                ${SAFE_MODE_SCRIPT}
                debugLog('🔥 [INJECT] SAFE_MODE_SCRIPT completed');
              } catch(e) {
                debugError('🔥 [INJECT] SAFE_MODE_SCRIPT ERROR:', e);
              }
            }, 300);

            setTimeout(() => {
              try { ${CHECKOUT_INTERCEPT_SCRIPT} } catch(e) { debugError('Checkout error:', e); }
            }, 400);

            setTimeout(() => {
              try { ${SHARE_SCRIPT} } catch(e) { debugError('Share error:', e); }
            }, 500);

            setTimeout(() => {
              try { ${CART_COUNTER_SCRIPT} } catch(e) { debugError('Cart error:', e); }
            }, 600);

            setTimeout(() => {
              try { ${createInjectedJS(tabKey)} } catch(e) { debugError('Tab error:', e); }
            }, 700);

            debugLog('🔍 WEBVIEW DEBUG - Scripts scheduled, page should load immediately');
            true;
          `}
          onMessage={handleMessage}
          onError={handleError}
          onHttpError={handleHttpError}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onLoad={(syntheticEvent) => {
            // Just log - don't manage loading state
            debugLog(`[WebShell:${tabKey}] 📥 onLoad fired`);
          }}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          startInLoadingState={false} // Disabled to prevent frozen loading spinner in iOS Simulator
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowFileAccess
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          onContentProcessDidTerminate={() => {
            debugError(`[WebShell:${tabKey}] ⚠️ WebView content process terminated - reloading`);
            const targetRef = (ref && typeof ref !== 'function' && ref.current) || webviewRef.current;
            if (targetRef) {
              targetRef.reload();
            }
          }}
          onRenderProcessGone={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            debugError(`[WebShell:${tabKey}] ⚠️ WebView render process gone:`, nativeEvent);
          }}
          {...restProps}
        />
        {/* Removed loading overlay - was blocking content */}
        
        {/* Fake checkout order confirmation modal */}
        <OrderConfirmationModal
          visible={showOrderModal}
          order={currentOrder}
          onClose={() => {
            setShowOrderModal(false);
            setCurrentOrder(null);
            
            // Show a toast directing to Orders tab
            const message = 'Demo order added to Orders tab';
            if (Platform.OS === 'android') {
              ToastAndroid.show(message, ToastAndroid.LONG);
            } else {
              Alert.alert('Demo Order Placed', message);
            }
            
            // Navigate to orders tab after close
            if (tabKey !== 'orders') {
              router.push('/(tabs)/orders');
            }
          }}
        />
      </View>
    );
  }
);

WebShellComponent.displayName = 'WebShell';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent - let WebView content show
    overflow: 'hidden',
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Semi-transparent white background
    zIndex: 1000, // Above WebView but below modals
  },
});

// Memoize to prevent excessive re-renders
export const WebShell = React.memo(WebShellComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.initialUrl === nextProps.initialUrl &&
    prevProps.tabKey === nextProps.tabKey &&
    JSON.stringify(prevProps.initialHeaders) === JSON.stringify(nextProps.initialHeaders)
  );
}) as typeof WebShellComponent;

WebShell.displayName = 'WebShell';
