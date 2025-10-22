import React, { useRef } from "react";
import type { WebView } from "react-native-webview";
import { WebShell } from "@/components/WebShell";
import { webviewRefs } from "./_layout";
import { useFocusEffect } from "@react-navigation/native";

export default function SearchTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.search = ref;

  // Cache the initial URL to prevent unnecessary reloads
  const initialUrl = React.useMemo(() => "https://greenhauscc.com/products", []);

  useFocusEffect(React.useCallback(()=>{
    console.log('[Search Tab] 🔍 Focused - requesting cart count update');
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
      initialUrl={initialUrl}
      tabKey="search"
    />
  );
}
