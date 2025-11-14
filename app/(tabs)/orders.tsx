import React, { useRef } from "react";
import { View, StyleSheet } from "react-native";
import type { WebView } from "react-native-webview";
import { WebShell } from "@/components/WebShell";
import { FakeOrdersList } from "@/components/FakeOrdersList";
import { webviewRefs } from "./_layout";
import { useFocusEffect } from "@react-navigation/native";
import { REVIEW_BUILD, REVIEW_DEMO_FAKE_CHECKOUT } from "@/constants/config";

export default function OrdersTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.orders = ref;

  useFocusEffect(React.useCallback(()=>{
    console.log('[Orders Tab] 📦 Focused - requesting cart count update');
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
    <View style={styles.container}>
      <WebShell
        ref={ref}
        initialUrl="https://greenhauscc.com/account/orders"
        tabKey="orders"
        style={{ opacity: REVIEW_BUILD && REVIEW_DEMO_FAKE_CHECKOUT ? 0 : 1 }}
      />
      
      {/* Fake orders overlay for review */}
      <FakeOrdersList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
