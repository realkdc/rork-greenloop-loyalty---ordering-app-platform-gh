import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Store, MapPin, Clock, ChevronRight } from 'lucide-react-native';
import colors from '@/constants/colors';
import { StorageService } from '@/services/storage';
import { getStoresByState } from '@/constants/stores';
import type { Store as StoreType } from '@/types';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StorePickerScreen() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreType[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreType | null>(null);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    const onboarding = await StorageService.getOnboardingState();
    if (onboarding?.state) {
      const storeList = getStoresByState(onboarding.state);
      console.log('Loaded stores for state:', onboarding.state, storeList.length);
      setStores(storeList);
    }
  };

  const handleStoreSelect = (store: StoreType) => {
    setSelectedStore(store);
  };

  const handleShopNow = async () => {
    if (!selectedStore) {
      Alert.alert('Select Store', 'Please select a store to continue.');
      return;
    }

    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ageVerified: existing?.ageVerified || false,
      state: existing?.state || null,
      stateSupported: existing?.stateSupported || false,
      activeStoreId: selectedStore.id,
      completedOnboarding: true,
    });

    console.log('Store selected, navigating to tabs');
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Store size={32} color={colors.primary} strokeWidth={2.5} />
          <Text style={styles.title}>Select Your Store</Text>
          <Text style={styles.subtitle}>Choose a location to start shopping</Text>
        </View>

        <ScrollView style={styles.storeList}>
          {stores.map((store) => (
            <TouchableOpacity
              key={store.id}
              style={[
                styles.storeCard,
                selectedStore?.id === store.id && styles.storeCardSelected,
              ]}
              onPress={() => handleStoreSelect(store)}
              activeOpacity={0.7}
            >
              <View style={styles.storeHeader}>
                <View style={styles.storeIconContainer}>
                  <MapPin size={24} color={colors.primary} />
                </View>
                <View style={styles.storeInfo}>
                  <Text style={styles.storeName}>{store.name}</Text>
                  <Text style={styles.storeAddress}>
                    {store.address}, {store.city}
                  </Text>
                </View>
                {selectedStore?.id === store.id && (
                  <View style={styles.selectedBadge}>
                    <ChevronRight size={20} color={colors.surface} />
                  </View>
                )}
              </View>

              <View style={styles.storeHours}>
                <Clock size={16} color={colors.textSecondary} />
                <Text style={styles.hoursText}>{store.hours}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedStore && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={handleShopNow}
              activeOpacity={0.8}
            >
              <Text style={styles.shopButtonText}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  storeList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  storeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  storeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(15, 76, 58, 0.05)',
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 76, 58, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeHours: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoursText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  shopButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.surface,
  },
});
