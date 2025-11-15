import React, { useRef } from "react";
import { View } from "react-native";
import { webviewRefs } from "./_layout";
import { WebShell } from "@/components/WebShell";
import type { WebView } from "react-native-webview";

export default function SearchTab() {
  const webviewRef = useRef<WebView>(null);
  webviewRefs.search = webviewRef;

  // Simplified: Let WebView load naturally with initialUrl - no forced navigation
  // Cart ID persists via localStorage/cookies automatically

  return (
    <View style={{ flex: 1 }}>
      <WebShell
        ref={webviewRef}
        initialUrl="https://greenhauscc.com/products"
        tabKey="search"
      />
    </View>
  );
}
