/* eslint-disable @rork/linters/expo-router-enforce-safe-area-usage */
/* eslint-disable @rork/linters/expo-router-no-unregistered-tabs-files */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import type { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import { WebShell } from "@/components/WebShell";
import { useApp } from "@/contexts/AppContext";
import { getLivePromos, type PromoRecord } from "@/src/lib/promo";
import { webviewRefs } from "./_layout";

const REQUIRED_FIREBASE_KEYS = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

const getMissingEnv = (): string[] =>
  REQUIRED_FIREBASE_KEYS.filter((key) => !process.env[key]);

function PromoSkeleton() {
  return (
    <View style={styles.skeleton}>
      <View style={[styles.skeletonLine, { width: 80 }]} />
      <View style={[styles.skeletonLine, { width: '60%', marginTop: 12 }]} />
      <View style={[styles.skeletonLine, { width: '85%', marginTop: 8 }]} />
    </View>
  );
}

function normalizeStore(storeId: string | null | undefined): string | null {
  if (!storeId) return null;
  const value = storeId.toLowerCase();
  if (value.includes('cookeville')) return 'cookeville';
  if (value.includes('crossville')) return 'crossville';
  if (value === 'cookeville' || value === 'crossville') return value;
  return null;
}

export default function HomeTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.home = ref;
  const { selectedStoreId } = useApp();
  const storeSlug = useMemo(() => normalizeStore(selectedStoreId), [selectedStoreId]);
  const [promos, setPromos] = useState<PromoRecord[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const missingEnv = useMemo(() => getMissingEnv(), []);

  const activeStoreId = useMemo(() => {
    if (storeSlug) return storeSlug;
    console.warn('[PromoDebug] selectedStoreId missing; falling back to "crossville"');
    return 'crossville';
  }, [storeSlug]);

  const openPromoUrl = useCallback((url: string) => {
    if (!ref.current) return;
    const script = `(() => { try { window.location.href = ${JSON.stringify(url)}; } catch (_) {} return true; })();`;
    ref.current.injectJavaScript(script);
  }, []);

  const fetchPromos = useCallback(async () => {
    if (missingEnv.length > 0) {
      console.warn('[PromoDebug] Firebase environment is incomplete, skipping promo fetch.', missingEnv);
      setLoadingPromos(false);
      return;
    }

    const storeIds = activeStoreId ? [activeStoreId] : ['cookeville', 'crossville'];
    console.log('[PromoDebug] Fetching promos from collection \'promotions\'', {
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storeIds,
    });

    try {
      setLoadingPromos(true);
      const items = await getLivePromos({ storeIds, limit: 5 });
      console.log('[PromoDebug] Promo query returned', items.length, 'documents');
      setPromos(items);
    } catch (error: any) {
      console.warn('[PromoDebug] Firestore query failed', error);
      setPromos([]);
    } finally {
      setLoadingPromos(false);
    }
  }, [activeStoreId, missingEnv]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  useFocusEffect(React.useCallback(() => {
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
  }, []));

  const firstPromo = promos[0];

  return (
    <View style={styles.container}>
      <View style={styles.debugWrapper} pointerEvents="box-none">
        {missingEnv.length > 0 && (
          <View style={[styles.alertBox, styles.alertDanger]}>
            <Text style={styles.alertTitle}>Firebase env missing:</Text>
            <Text style={styles.alertBody}>{missingEnv.join(', ')}</Text>
          </View>
        )}
        {indexWarning && (
          <View style={[styles.alertBox, styles.alertWarning]}>
            <Text style={styles.alertTitle}>Composite index required—check Firebase console.</Text>
          </View>
        )}
        <View style={styles.promoDebugCard}>
          <View style={styles.debugHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Promos found: {promos.length}</Text>
            </View>
            <TouchableOpacity onPress={fetchPromos} activeOpacity={0.75} style={styles.reloadButton}>
              <Text style={styles.reloadLabel}>Reload promos</Text>
            </TouchableOpacity>
          </View>
          {loadingPromos && promos.length === 0 ? (
            <PromoSkeleton />
          ) : firstPromo ? (
            <View style={styles.promoSummary}>
              <Text style={styles.summaryTitle}>{firstPromo.title}</Text>
              {!!firstPromo.body && <Text style={styles.summaryBody}>{firstPromo.body}</Text>}
              {firstPromo.deepLinkUrl && (
                <TouchableOpacity
                  onPress={() => openPromoUrl(firstPromo.deepLinkUrl as string)}
                  activeOpacity={0.75}
                  style={styles.viewButton}
                >
                  <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.noPromoText}>No active promos for {activeStoreId}</Text>
          )}
        </View>
      </View>
      <View style={styles.webShellWrapper}>
        <WebShell
          ref={ref}
          initialUrl="https://greenhauscc.com/"
          tabKey="home"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  debugWrapper: {
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    gap: 12,
    zIndex: 10,
  },
  webShellWrapper: {
    flex: 1,
  },
  skeleton: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  alertBox: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  alertDanger: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  alertTitle: {
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  alertBody: {
    color: '#991B1B',
  },
  promoDebugCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  reloadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1E4D3A',
  },
  reloadLabel: {
    color: '#1E4D3A',
    fontSize: 12,
    fontWeight: '600',
  },
  promoSummary: {
    gap: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  summaryBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  noPromoText: {
    fontSize: 13,
    color: '#6B7280',
  },
  viewButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E4D3A',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
