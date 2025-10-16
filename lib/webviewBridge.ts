import type WebView from 'react-native-webview';
import React from "react";

export function scrollToTop(webViewRef: React.RefObject<WebView | null>) {
  webViewRef.current?.injectJavaScript("window.scrollTo({top:0,behavior:'instant'}); true;");
}

export function reloadToUrl(webViewRef: React.RefObject<WebView | null>, url: string) {
  webViewRef.current?.injectJavaScript(`
    if (window.location.href !== '${url}') {
      window.location.href = '${url}';
    }
    window.scrollTo({top:0,behavior:'instant'});
    true;
  `);
}

export function getCurrentUrl(webViewRef: React.RefObject<WebView | null>): Promise<string | null> {
  return new Promise((resolve) => {
    webViewRef.current?.injectJavaScript(`
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'current-url',
        url: window.location.href
      }));
      true;
    `);
    
    setTimeout(() => resolve(null), 1000);
  });
}
