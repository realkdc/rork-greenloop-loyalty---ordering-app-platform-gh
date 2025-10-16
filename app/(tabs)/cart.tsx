/* eslint-disable @rork/linters/expo-router-enforce-safe-area-usage */
/* eslint-disable @rork/linters/expo-router-no-unregistered-tabs-files */
import React, { useRef } from "react";
import type { WebView } from "react-native-webview";
import { WebShell } from "@/components/WebShell";
import { webviewRefs } from "./_layout";
import { useFocusEffect } from "@react-navigation/native";

export default function CartTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.cart = ref;

  useFocusEffect(React.useCallback(()=>{
    console.log('[Cart Tab] 👀 Focused - requesting cart count update');
    setTimeout(() => {
      ref.current?.injectJavaScript(`
        (function(){
          try{
            console.log('[Cart Tab] 📡 Sending PING to cart counter');
            if (window.__ghCC) {
              window.__ghCC.active = true;
              window.postMessage(JSON.stringify({type: 'PING'}), '*');
            }
            window.dispatchEvent(new Event('focus'));
          }catch(e){
            console.error('[Cart] Focus event error:', e);
          }
        })();
        true;
      `);
    }, 100);
    return undefined;
  },[]));

  return (
    <WebShell
      ref={ref}
      initialUrl="https://greenhauscc.com/products/cart"
      tabKey="cart"
    />
  );
}
