/**
 * Android Checkout Blocker V4
 *
 * NUCLEAR OPTION: Intercepts Ecwid API to completely disable checkout.
 * Runs BEFORE page content loads to block at the API level.
 */

export const ANDROID_CHECKOUT_BLOCKER_PRELOAD = `
// Block Ecwid cart/checkout at API level
if (typeof window !== 'undefined') {
  console.log('[AndroidBlocker] PRE-LOAD INIT');

  // Hijack window.location to block cart/checkout
  const originalLocationSetter = Object.getOwnPropertyDescriptor(window.Location.prototype, 'href').set;
  Object.defineProperty(window.Location.prototype, 'href', {
    set: function(url) {
      if (url && (url.includes('cart') || url.includes('checkout'))) {
        console.log('[AndroidBlocker] BLOCKED location.href =', url);
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'OPEN_EXTERNAL_URL',
          url: 'https://greenhauscc.com/products/cart'
        }));
        return;
      }
      originalLocationSetter.call(this, url);
    }
  });
}
true;
`;

export const ANDROID_CHECKOUT_BLOCKER_SCRIPT = "(function() {\n" +
"  var TAG = '[AndroidCheckoutBlocker]';\n" +
"  console.log(TAG + ' 🚀🚀🚀 INITIALIZING V3 🚀🚀🚀');\n" +
"\n" +
"  function block(reason, url) {\n" +
"    console.log(TAG + ' 🚫 BLOCKING: ' + reason + ' -> ' + (url || ''));\n" +
"    console.log(TAG + ' 🌐 Opening external browser...');\n" +
"    var targetUrl = url || 'https://greenhauscc.com/products/cart';\n" +
"    console.log(TAG + ' 🔗 Target URL: ' + targetUrl);\n" +
"    \n" +
"    if (window.ReactNativeWebView) {\n" +
"      console.log(TAG + ' ✅ ReactNativeWebView available, posting message');\n" +
"      window.ReactNativeWebView.postMessage(JSON.stringify({\n" +
"        type: 'OPEN_EXTERNAL_URL',\n" +
"        url: targetUrl\n" +
"      }));\n" +
"      console.log(TAG + ' 📤 Message posted to ReactNativeWebView');\n" +
"    } else {\n" +
"      console.log(TAG + ' ❌ ReactNativeWebView NOT available');\n" +
"    }\n" +
"    \n" +
"    try {\n" +
"      alert('To complete your purchase, please visit our website at greenhauscc.com');\n" +
"    } catch(e) {\n" +
"      console.log(TAG + ' Alert error: ' + e);\n" +
"    }\n" +
"    return false;\n" +
"  }\n" +
"\n" +
"  // 1. CSS Hiding (Fastest)\n" +
"  var style = document.createElement('style');\n" +
"  style.textContent = [\n" +
"    '.ec-cart__button--checkout', '.ec-cart-summary__checkout-button', \n" +
"    '.ec-store .ec-cart__button--checkout', '[data-action=\"checkout\"]', \n" +
"    '.ec-product-details__buy-now', '.ec-product-details__button--buy-now', \n" +
"    '.ec-product-details__add-to-cart', 'button[class*=\"checkout\" i]', \n" +
"    'button[class*=\"buy-now\" i]', 'a[href*=\"/checkout\" i]', \n" +
"    'a[href*=\"/cart\" i]', '[class*=\"ec-minicart\"]', '.ec-cart-next'\n" +
"  ].join(', ') + ' { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }';\n" +
"  if (document.documentElement) document.documentElement.appendChild(style);\n" +
"\n" +
"  // 2. Global Click Interception (Capture Phase)\n" +
"  document.addEventListener('click', function(e) {\n" +
"    var el = e.target;\n" +
"    while (el) {\n" +
"      var text = (el.textContent || '').toLowerCase();\n" +
"      var href = el.href || el.getAttribute('href') || '';\n" +
"      var classStr = typeof el.className === 'string' ? el.className.toLowerCase() : '';\n" +
"\n" +
"      var isCheckout = \n" +
"        text.indexOf('checkout') !== -1 || \n" +
"        text.indexOf('place order') !== -1 || \n" +
"        text.indexOf('buy now') !== -1 ||\n" +
"        text.indexOf('go to cart') !== -1 ||\n" +
"        text.indexOf('view cart') !== -1 ||\n" +
"        text.indexOf('add to cart') !== -1 ||\n" +
"        href.indexOf('checkout') !== -1 || \n" +
"        href.indexOf('cart') !== -1 ||\n" +
"        classStr.indexOf('checkout') !== -1 ||\n" +
"        classStr.indexOf('cart') !== -1;\n" +
"\n" +
"      if (isCheckout) {\n" +
"        console.log(TAG + ' 🎯 Intercepted click on: ' + el.tagName + ' (' + text.substring(0,20) + ')');\n" +
"        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();\n" +
"        block('Click on ' + text.substring(0,20), href || 'https://greenhauscc.com/products/cart');\n" +
"        return false;\n" +
"      }\n" +
"      el = el.parentElement;\n" +
"    }\n" +
"  }, true);\n" +
"\n" +
"  // 3. Navigation/Hash API\n" +
"  var originalPush = history.pushState;\n" +
"  history.pushState = function() {\n" +
"    var url = arguments[2] || '';\n" +
"    if (url && (url.indexOf('checkout') !== -1 || url.indexOf('cart') !== -1)) return block('pushState', url);\n" +
"    return originalPush.apply(this, arguments);\n" +
"  };\n" +
"\n" +
"  window.addEventListener('hashchange', function() {\n" +
"    if (window.location.hash.indexOf('checkout') !== -1 || window.location.hash.indexOf('cart') !== -1) {\n" +
"      block('Hash change', window.location.href);\n" +
"    }\n" +
"  });\n" +
"\n" +
"  // 4. Cleanup Loop (Dynamic content)\n" +
"  function cleanup() {\n" +
"    var items = document.querySelectorAll('button, a, [data-action=\"checkout\"]');\n" +
"    for (var i = 0; i < items.length; i++) {\n" +
"      var el = items[i];\n" +
"      var text = (el.textContent || '').toLowerCase();\n" +
"      var href = el.href || el.getAttribute('href') || '';\n" +
"      if (text.indexOf('checkout') !== -1 || text.indexOf('cart') !== -1 || text.indexOf('buy now') !== -1 || href.indexOf('checkout') !== -1 || href.indexOf('cart') !== -1) {\n" +
"        if (el.style.display !== 'none') el.style.display = 'none';\n" +
"        if (!el.nextSibling || el.nextSibling.id !== 'gh-web-redirect') {\n" +
"          var div = document.createElement('div');\n" +
"          div.id = 'gh-web-redirect';\n" +
"          div.style.cssText = 'background:#f0fdf4; border:1px solid #16a34a; padding:15px; margin:10px 0; border-radius:8px; text-align:center;';\n" +
"          div.innerHTML = '<p style=\"margin:0 0 10px 0; color:#166534; font-weight:bold;\">Complete Purchase on Website</p>' +\n" +
"                         '<a href=\"https://greenhauscc.com/products/cart\" style=\"display:inline-block; padding:10px 20px; background:#0F4C3A; color:white; border-radius:6px; text-decoration:none; font-weight:bold;\">Visit Website to Checkout</a>';\n" +
"          el.parentNode.insertBefore(div, el.nextSibling);\n" +
"        }\n" +
"      }\n" +
"    }\n" +
"  }\n" +
"  setInterval(cleanup, 800);\n" +
"  console.log(TAG + ' ✅ HYPER-AGGRESSIVE BLOCKER V3 ACTIVE');\n" +
"})();\n" +
"true;";
