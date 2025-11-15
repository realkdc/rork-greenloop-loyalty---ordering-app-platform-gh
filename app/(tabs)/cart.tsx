import React, { useRef } from "react";
import { View } from "react-native";
import { webviewRefs } from "./_layout";
import { useFocusEffect } from "@react-navigation/native";
import { WebShell } from "@/components/WebShell";
import type { WebView } from "react-native-webview";

export default function CartTab() {
  const webviewRef = useRef<WebView>(null);
  webviewRefs.cart = webviewRef;

  // Simplified: Don't force navigation - let WebView load naturally
  // This prevents delays and ensures fast loading
  useFocusEffect(
    React.useCallback(() => {
      console.log('[CartTab] 🛒 Tab focused - WebView will load with initialUrl');
      // Let the WebView handle navigation naturally - no forced navigation
    }, [])
  );

  return (
    <View style={{ flex: 1 }}>
      <WebShell
        ref={webviewRef}
        initialUrl="https://greenhauscc.com/products/cart"
        tabKey="cart"
      />
    </View>
  );
}
