/* eslint-disable @rork/linters/expo-router-enforce-safe-area-usage */
/* eslint-disable @rork/linters/expo-router-no-unregistered-tabs-files */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import type { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { WebShell } from "@/components/WebShell";
import { PromoCard } from "@/components/PromoCard";
import { useApp } from "@/contexts/AppContext";
import { getPromos, type PromoRecord } from "@/src/lib/promos";
import { webviewRefs } from "./_layout";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const cycleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();

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
      if (items.length > 0) {
        setCurrentPromoIndex(0);
      }
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

  useEffect(() => {
    if (!promos.length) {
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
      setCurrentPromoIndex(0);
      return;
    }

    if (cycleTimerRef.current) {
      clearInterval(cycleTimerRef.current);
    }

    cycleTimerRef.current = setInterval(() => {
      setCurrentPromoIndex((prev) => (prev + 1) % promos.length);
    }, 8000);

    return () => {
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
    };
  }, [promos]);

  useEffect(() => () => {
    if (cycleTimerRef.current) {
      clearInterval(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
  }, []);

  const handleNextPromo = useCallback(() => {
    if (!promos.length) return;
    setCurrentPromoIndex((prev) => (prev + 1) % promos.length);
  }, [promos]);

  const handlePrevPromo = useCallback(() => {
    if (!promos.length) return;
    setCurrentPromoIndex((prev) => (prev - 1 + promos.length) % promos.length);
  }, [promos]);

  useEffect(() => {
    if (currentPromoIndex >= promos.length && promos.length > 0) {
      setCurrentPromoIndex(0);
    }
  }, [currentPromoIndex, promos]);

  const currentPromo = promos[currentPromoIndex] ?? null;

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
      <View
        style={[
          styles.promoWrapper,
          { paddingTop: Math.max(insets.top, 12) + 12 },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.promoHeader}>
          <Text style={styles.promoHeading}>{activeStoreId.toUpperCase()} PROMOTIONS</Text>
          {promos.length > 1 && (
            <Text style={styles.promoMeta}>
              {currentPromoIndex + 1} / {promos.length}
            </Text>
          )}
        </View>

        {loadingPromos ? (
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLineShort} />
          </View>
        ) : currentPromo ? (
          <PromoCard promo={currentPromo} onPressView={openPromoUrl} />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No promotions available right now.</Text>
          </View>
        )}

        {promos.length > 1 && (
          <View style={styles.promoControls}>
            <TouchableOpacity
              onPress={handlePrevPromo}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Previous promotion"
            >
              <Ionicons name="chevron-back" size={20} color="#1E4D3A" />
            </TouchableOpacity>
            <View style={styles.dots}>
              {promos.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentPromoIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
            <TouchableOpacity
              onPress={handleNextPromo}
              style={styles.navButton}
              accessibilityRole="button"
              accessibilityLabel="Next promotion"
            >
              <Ionicons name="chevron-forward" size={20} color="#1E4D3A" />
            </TouchableOpacity>
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
    paddingBottom: 16,
    gap: 12,
    backgroundColor: "#FFFFFF",
    zIndex: 10,
  },
  promoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promoHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E4D3A",
    letterSpacing: 1,
  },
  promoMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
  promoControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -4,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: "#1E4D3A",
    width: 18,
  },
  skeletonCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  skeletonLineWide: {
    height: 18,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    width: "70%",
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    width: "85%",
  },
  skeletonLineShort: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E5E7EB",
    width: "55%",
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
  },
  webShellWrapper: {
    flex: 1,
  },
});
