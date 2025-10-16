// Simple test to check if WebView script is running
console.log('🔍 WEBVIEW DEBUG TEST');
console.log('Window object:', typeof window);
console.log('Document object:', typeof document);
console.log('ReactNativeWebView:', typeof window.ReactNativeWebView);

// Test if our script is installed
console.log('__ghCartCounter installed:', !!window.__ghCartCounter);
if (window.__ghCartCounter) {
  console.log('__ghCartCounter details:', window.__ghCartCounter);
}

// Test cart detection
function testCartDetection() {
  console.log('🔍 Testing cart detection...');
  
  // Test 1: Header badge
  const headerBadge = document.querySelector('a.ins-header__icon.ins-header__icon--cart[data-count]');
  console.log('Header badge found:', !!headerBadge);
  if (headerBadge) {
    console.log('Header badge data-count:', headerBadge.getAttribute('data-count'));
  }
  
  // Test 2: Any cart-related elements
  const cartElements = document.querySelectorAll('[data-count], .cart, [class*="cart"]');
  console.log('Cart elements found:', cartElements.length);
  
  // Test 3: Send test message
  if (window.ReactNativeWebView) {
    console.log('📤 Sending test message to React Native');
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'CART_COUNT',
      value: 999,
      source: 'debug-test'
    }));
  } else {
    console.log('❌ ReactNativeWebView not available');
  }
}

// Run test after a short delay
setTimeout(testCartDetection, 1000);

console.log('🔍 Debug test loaded');
