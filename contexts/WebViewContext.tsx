import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useRef, type RefObject } from 'react';
import type WebView from 'react-native-webview';

interface WebViewState {
  isLoggedIn: boolean;
  cartCount: number;
  pendingAuthUrl: string | null;
  homeWebViewRef: RefObject<WebView | null>;
  searchWebViewRef: RefObject<WebView | null>;
  cartWebViewRef: RefObject<WebView | null>;
  ordersWebViewRef: RefObject<WebView | null>;
  profileWebViewRef: RefObject<WebView | null>;
  setLoggedIn: (value: boolean) => void;
  setCartCount: (count: number) => void;
  setPendingAuthUrl: (url: string | null) => void;
  reloadAllWebViews: () => void;
  navigateToUrl: (url: string, tabKey?: 'home' | 'search' | 'cart' | 'orders' | 'profile') => void;
}

export const [WebViewProvider, useWebView] = createContextHook<WebViewState>(() => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [cartCount, setCartCount] = useState<number>(0);
  const [pendingAuthUrl, setPendingAuthUrlState] = useState<string | null>(null);
  
  const homeWebViewRef = useRef<WebView>(null);
  const searchWebViewRef = useRef<WebView>(null);
  const cartWebViewRef = useRef<WebView>(null);
  const ordersWebViewRef = useRef<WebView>(null);
  const profileWebViewRef = useRef<WebView>(null);

  const setLoggedIn = useCallback((value: boolean) => {
    console.log('✅ WebView context: setLoggedIn', value);
    setIsLoggedIn(value);
  }, []);

  const setCartCountCallback = useCallback((count: number) => {
    console.log('🛒 Cart count updated:', count);
    setCartCount(count);
  }, []);

  const setPendingAuthUrl = useCallback((url: string | null) => {
    console.log('🔗 Setting pending auth URL:', url);
    setPendingAuthUrlState(url);
  }, []);

  const navigateToUrl = useCallback((url: string, tabKey?: 'home' | 'search' | 'cart' | 'orders' | 'profile') => {
    console.log('🔗 Navigating to URL:', url, 'in tab:', tabKey || 'profile');
    const ref = tabKey === 'home' ? homeWebViewRef :
                tabKey === 'search' ? searchWebViewRef :
                tabKey === 'cart' ? cartWebViewRef :
                tabKey === 'orders' ? ordersWebViewRef :
                profileWebViewRef;
    
    if (ref.current) {
      ref.current.injectJavaScript(`window.location.href = '${url}'; true;`);
    } else {
      setPendingAuthUrlState(url);
    }
  }, []);

  const reloadAllWebViews = useCallback(() => {
    console.log('🔄 Reloading all WebViews');
    homeWebViewRef.current?.reload();
    searchWebViewRef.current?.reload();
    cartWebViewRef.current?.reload();
    ordersWebViewRef.current?.reload();
    profileWebViewRef.current?.reload();
  }, []);

  return {
    isLoggedIn,
    cartCount,
    pendingAuthUrl,
    homeWebViewRef,
    searchWebViewRef,
    cartWebViewRef,
    ordersWebViewRef,
    profileWebViewRef,
    setLoggedIn,
    setCartCount: setCartCountCallback,
    setPendingAuthUrl,
    reloadAllWebViews,
    navigateToUrl,
  };
});
