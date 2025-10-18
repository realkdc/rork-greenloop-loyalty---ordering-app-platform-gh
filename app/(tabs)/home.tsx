/* eslint-disable @rork/linters/expo-router-enforce-safe-area-usage */
/* eslint-disable @rork/linters/expo-router-no-unregistered-tabs-files */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import type { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { WebShell } from "@/components/WebShell";
import { PromoPopup } from "@/components/PromoPopup";
import { useApp } from "@/contexts/AppContext";
import { getPromos, type PromoRecord } from "@/src/lib/promos";
import { webviewRefs } from "./_layout";

function normalizeStore(storeId: string | null | undefined): "cookeville" | "crossville" | null {
  if (!storeId) return null;
  const value = storeId.toLowerCase();
  if (value.includes("cookeville")) return "cookeville";
  if (value.includes("crossville")) return "crossville";
  if (value === "cookeville" || value === "crossville") return value;
  return null;
}

export default function HomeTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.home = ref;
  const { selectedStoreId, promoPopupShown, setPromoPopupShown } = useApp();
  const storeSlug = useMemo(() => normalizeStore(selectedStoreId), [selectedStoreId]);
  const [promos, setPromos] = useState<PromoRecord[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [showPopup, setShowPopup] = useState(false);

  const activeStoreId = useMemo<"cookeville" | "crossville">(() => {
    if (storeSlug) return storeSlug;
    console.warn("[Promo] selectedStoreId missing; falling back to crossville");
    return "crossville";
  }, [storeSlug]);

  const openPromoUrl = useCallback((url: string) => {
    if (!ref.current) return;
    const script = `(() => { try { window.location.href = ${JSON.stringify(url)}; } catch (_) {} return true; })();`;
    ref.current.injectJavaScript(script);
  }, []);

  const fetchPromos = useCallback(async () => {
    try {
      setLoadingPromos(true);
      const items = await getPromos(activeStoreId);
      console.log("[promos]", { storeId: selectedStoreId, count: items.length });
      setPromos(items);
      
      // Show popup if we have promos and haven't shown it yet for this store
      if (items.length > 0 && !promoPopupShown) {
        setShowPopup(true);
        setPromoPopupShown(true);
      }
    } catch (error) {
      console.warn("[promos] failed to load", error);
      setPromos([]);
    } finally {
      setLoadingPromos(false);
    }
  }, [activeStoreId, selectedStoreId, promoPopupShown, setPromoPopupShown]);

  // Reset popup state when store changes
  useEffect(() => {
    setPromoPopupShown(false);
    setShowPopup(false);
  }, [activeStoreId, setPromoPopupShown]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const handleClosePopup = useCallback(() => {
    setShowPopup(false);
  }, []);

  const handlePromoView = useCallback((url: string) => {
    openPromoUrl(url);
    setShowPopup(false);
  }, [openPromoUrl]);

  useFocusEffect(
    React.useCallback(() => {
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
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.webShellWrapper}>
        <WebShell ref={ref} initialUrl="https://greenhauscc.com/" tabKey="home" />
      </View>
      
      <PromoPopup
        visible={showPopup}
        promos={promos}
        onClose={handleClosePopup}
        onPressView={handlePromoView}
        storeName={activeStoreId.toUpperCase()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webShellWrapper: {
    flex: 1,
  },
});
