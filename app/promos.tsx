import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator, Text, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { PromoCard } from '@/components/PromoCard';
import { getLivePromos, type PromoRecord } from '@/src/lib/promo';

function normalizeStore(storeId: string | null | undefined): string | null {
  if (!storeId) return null;
  const value = storeId.toLowerCase();
  if (value.includes('cookeville')) return 'cookeville';
  if (value.includes('crossville')) return 'crossville';
  if (value === 'cookeville' || value === 'crossville') return value;
  return null;
}

export default function PromosScreen() {
  const { selectedStoreId } = useApp();
  const storeSlug = normalizeStore(selectedStoreId);
  const [promos, setPromos] = useState<PromoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPromos = useCallback(
    async (opts: { refresh?: boolean } = {}) => {
      console.log('[PromosScreen] 🔄 Loading promos...', {
        selectedStoreId,
        storeSlug,
        refresh: opts.refresh,
      });

      if (!storeSlug) {
        console.log('[PromosScreen] ⚠️ No store selected');
        setPromos([]);
        setLoading(false);
        setRefreshing(false);
        setError(null);
        return;
      }

      try {
        if (!opts.refresh) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        console.log(`[PromosScreen] 📲 Fetching promos for store: ${storeSlug}`);
        const live = await getLivePromos({ storeIds: [storeSlug] });
        console.log(`[PromosScreen] 📦 Received ${live.length} promos from service`);
        
        const filtered = live.filter((promo) => {
          if (!promo.storeId) return false;
          const slug = promo.storeId.toLowerCase();
          return slug.includes(storeSlug);
        });
        console.log(`[PromosScreen] ✅ Filtered to ${filtered.length} promos`);
        setPromos(filtered);
        setError(null);
      } catch (err: any) {
        console.error('[PromosScreen] 💥 Failed to load promos:', err);
        console.error('[PromosScreen] Error details:', {
          message: err?.message,
          code: err?.code,
        });
        setError('Unable to load promotions right now.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeSlug, selectedStoreId]
  );

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Promotions' }} />

      {!storeSlug && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            Select a store to view the latest promotions.
          </Text>
        </View>
      )}

      {storeSlug && loading && promos.length === 0 && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#1E4D3A" />
        </View>
      )}

      {storeSlug && !loading && promos.length === 0 && !error && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>No promotions available right now.</Text>
        </View>
      )}

      {storeSlug && error && (
        <View style={styles.messageContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {storeSlug && promos.length > 0 && (
        <FlatList
          data={promos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <PromoCard promo={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPromos({ refresh: true })}
              tintColor="#1E4D3A"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loaderContainer: {
    paddingVertical: 32,
  },
  list: {
    padding: 16,
    gap: 16,
  },
  separator: {
    height: 16,
  },
  messageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  messageText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    textAlign: 'center',
    color: '#DC2626',
    fontSize: 15,
    lineHeight: 22,
  },
});
