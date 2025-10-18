/* eslint-disable @rork/linters/expo-router-enforce-safe-area-usage */
/* eslint-disable @rork/linters/expo-router-no-unregistered-tabs-files */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import type { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { WebShell } from "@/components/WebShell";
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
  const { selectedStoreId } = useApp();
  const storeSlug = useMemo(() => normalizeStore(selectedStoreId), [selectedStoreId]);
  const [promos, setPromos] = useState<PromoRecord[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);

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
    } catch (error) {
      console.warn("[promos] failed to load", error);
      setPromos([]);
    } finally {
      setLoadingPromos(false);
    }
  }, [activeStoreId, selectedStoreId]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

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

  const firstPromo = promos[0];

  return (
    <View style={styles.container}>
      <View style={styles.promoWrapper} pointerEvents="box-none">
        {loadingPromos ? (
          <View style={styles.promoCard}>
            <Text style={styles.promoLabel}>Promotions</Text>
            <Text style={styles.promoBody}>Loading the latest offers…</Text>
          </View>
        ) : firstPromo ? (
          <View style={styles.promoCard}>
            <Text style={styles.promoLabel}>{activeStoreId.toUpperCase()} PROMOTIONS</Text>
            <Text style={styles.promoTitle}>{firstPromo.title}</Text>
            {!!firstPromo.body && <Text style={styles.promoBody}>{firstPromo.body}</Text>}
            {firstPromo.deepLinkUrl && (
              <TouchableOpacity
                onPress={() => openPromoUrl(firstPromo.deepLinkUrl as string)}
                activeOpacity={0.75}
                style={styles.viewButton}
              >
                <Text style={styles.viewButtonText}>View Offer</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.promoCard}>
            <Text style={styles.promoLabel}>{activeStoreId.toUpperCase()} PROMOTIONS</Text>
            <Text style={styles.promoBody}>No promotions available right now.</Text>
          </View>
        )}
      </View>
      <View style={styles.webShellWrapper}>
        <WebShell ref={ref} initialUrl="https://greenhauscc.com/" tabKey="home" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  promoWrapper: {
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    gap: 12,
    zIndex: 10,
  },
  webShellWrapper: {
    flex: 1,
  },
  promoCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  promoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E4D3A",
    letterSpacing: 1,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  promoBody: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  viewButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#1E4D3A",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  viewButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
