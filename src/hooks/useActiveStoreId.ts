import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { migrateFromStore123 } from '@/src/lib/migration';

const STORE_ID_KEY = 'gh.activeStoreId';

interface UseActiveStoreIdReturn {
  storeId: string | null;
  setStoreId: (id: string | null) => Promise<void>;
  ready: boolean;
}

export function useActiveStoreId(): UseActiveStoreIdReturn {
  const { user } = useAuth();
  const { selectedStoreId, setSelectedStoreId } = useApp();
  const [ready, setReady] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Run migration from store_123 if needed
        const migrated = await migrateFromStore123();
        if (migrated) {
          console.log('[useActiveStoreId] Migration completed, user will need to select a new store');
        }

        // Load from SecureStore for guests or from AppContext for signed-in users
        if (user) {
          // For signed-in users, use the AppContext value
          console.log('[useActiveStoreId] Signed-in user, using AppContext storeId:', selectedStoreId);
          setReady(true);
        } else {
          // For guests, check SecureStore
          const storedStoreId = await SecureStore.getItemAsync(STORE_ID_KEY);
          console.log('[useActiveStoreId] Guest user, stored storeId:', storedStoreId);
          if (storedStoreId && storedStoreId !== 'store_123') {
            // Update AppContext with the stored value
            await setSelectedStoreId(storedStoreId);
          }
          setReady(true);
        }
      } catch (error) {
        console.error('[useActiveStoreId] Failed to initialize:', error);
        setReady(true);
      }
    };

    initialize();
  }, [user, setSelectedStoreId, selectedStoreId]);

  const setStoreId = useCallback(async (id: string | null) => {
    try {
      if (user) {
        // For signed-in users, update through AppContext (which persists to AsyncStorage)
        await setSelectedStoreId(id);
      } else {
        // For guests, store in SecureStore
        if (id) {
          await SecureStore.setItemAsync(STORE_ID_KEY, id);
        } else {
          await SecureStore.deleteItemAsync(STORE_ID_KEY);
        }
        // Also update AppContext for consistency
        await setSelectedStoreId(id);
      }
    } catch (error) {
      console.error('[useActiveStoreId] Failed to set store ID:', error);
    }
  }, [user, setSelectedStoreId]);

  // Debug logging when storeId changes
  useEffect(() => {
    if (ready && selectedStoreId) {
      console.log('[useActiveStoreId] Store ID ready:', selectedStoreId);
    }
  }, [ready, selectedStoreId]);

  return {
    storeId: selectedStoreId,
    setStoreId,
    ready,
  };
}
