import React, { useRef } from "react";
import type { WebView } from "react-native-webview";
import { WebShell } from "@/components/WebShell";
import { webviewRefs } from "./_layout";
import { useFocusEffect } from "@react-navigation/native";
import { Store } from "@/config/greenhaus";

export default function CartTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.cart = ref;

  useFocusEffect(
    React.useCallback(() => {
      const webview = ref.current;
      if (!webview) return undefined;

      console.log("[Cart Tab] 🔄 Reloading cart WebView for fresh state");
      try {
        webview.reload();
      } catch (reloadError) {
        console.warn("[Cart Tab] ⚠️ Failed to reload WebView:", reloadError);
      }

      const timer = setTimeout(() => {
        try {
          webview.injectJavaScript(`
            (function(){
              try {
                if (window.__ghCartCounter) {
                  window.__ghCartCounter.active = true;
                  window.postMessage(JSON.stringify({ type: 'PING' }), '*');
                }
                window.dispatchEvent(new Event('focus'));
              } catch (e) {
                console.error('[Cart] Focus event error:', e);
              }
              return true;
            })();
          `);
        } catch (injectError) {
          console.warn("[Cart Tab] ⚠️ Failed to inject focus script:", injectError);
        }
      }, 700);

      return () => clearTimeout(timer);
    }, [])
  );

  return (
    <WebShell
      ref={ref}
      initialUrl={Store.CART}
      tabKey="cart"
    />
  );
}
