import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from "react-native";
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
  const [isModalOpen, setModalOpen] = useState(false);
  const dismissedForSession = useRef(false);
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
    dismissedForSession.current = false;
  }, [activeStoreId]);

  useEffect(() => {
    if (promos.length > 0 && !dismissedForSession.current) {
      setModalOpen(true);
    }
  }, [promos]);

  useEffect(() => {
    if (!isModalOpen || promos.length <= 1) {
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
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
  }, [isModalOpen, promos]);

  useEffect(() => () => {
    if (cycleTimerRef.current) {
      clearInterval(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
  }, []);

  const handleNextPromo = useCallback(() => {
    if (!promos.length) return;
    setCurrentPromoIndex((prev) => (prev + 1) % promos.length);
  }, [promos.length]);

  const handlePrevPromo = useCallback(() => {
    if (!promos.length) return;
    setCurrentPromoIndex((prev) => (prev - 1 + promos.length) % promos.length);
  }, [promos.length]);

  const closeModal = useCallback(() => {
    dismissedForSession.current = true;
    setModalOpen(false);
  }, []);

  const openModal = useCallback(() => {
    if (!promos.length) return;
    setModalOpen(true);
  }, [promos.length]);

  useEffect(() => {
    if (currentPromoIndex >= promos.length && promos.length > 0) {
      setCurrentPromoIndex(0);
    }
  }, [currentPromoIndex, promos]);

  const currentPromo = promos[currentPromoIndex] ?? null;

  const handlePromoView = useCallback((url: string) => {
    openPromoUrl(url);
    closeModal();
  }, [openPromoUrl, closeModal]);

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

      {promos.length > 0 && !isModalOpen && (
        <TouchableOpacity
          onPress={openModal}
          activeOpacity={0.85}
          style={[
            styles.fab,
            {
              bottom: Math.max(insets.bottom, 16) + 24,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Show promotions"
        >
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={styles.fabLabel}>Promos</Text>
          {promos.length > 1 && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{promos.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {activeStoreId.toUpperCase()} PROMOTIONS
                  </Text>
                  <TouchableOpacity
                    onPress={closeModal}
                    style={styles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close promotions"
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {loadingPromos ? (
                  <View style={styles.skeletonCard}>
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLine} />
                    <View style={styles.skeletonLineShort} />
                  </View>
                ) : currentPromo ? (
                  <>
                    <PromoCard promo={currentPromo} onPressView={handlePromoView} />
                    {promos.length > 1 && (
                      <View style={styles.modalControls}>
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
                  </>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No promotions available right now.</Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1E4D3A",
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  fabLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 20, 13, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    width: "88%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 22,
    gap: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: -4,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E4D3A",
    letterSpacing: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  modalControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
});
