/* eslint-disable @rork/linters/expo-router-enforce-safe-area-usage */
/* eslint-disable @rork/linters/expo-router-no-unregistered-tabs-files */
import React, { useRef } from "react";
import type { WebView } from "react-native-webview";
import { WebShell } from "@/components/WebShell";
import { webviewRefs } from "./_layout";
import { useFocusEffect } from "@react-navigation/native";

export default function HomeTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.home = ref;

  useFocusEffect(React.useCallback(()=>{
    console.log('[Home Tab] 🏠 Focused - requesting cart count update');
    ref.current?.injectJavaScript(`
      (function(){ 
        try{ 
          if (window.__ghCartCounter) {
            window.__ghCartCounter.active = true;
            window.postMessage(JSON.stringify({type: 'PING'}), '*');
          }
          window.dispatchEvent(new Event('focus')); 
        }catch(e){} 
        window.scrollTo(0,0); 
        true; 
      })();
    `);
    return undefined;
  },[]));

  return (
    <WebShell
      ref={ref}
      initialUrl="https://greenhauscc.com/"
      tabKey="home"
    />
  );
}
