import * as SecureStore from 'expo-secure-store';
import { StorageService } from '@/services/storage';

const MIGRATION_KEY = 'gh.migration.store_123_completed';

export async function migrateFromStore123(): Promise<boolean> {
  try {
    // Check if migration has already been completed
    const migrationCompleted = await SecureStore.getItemAsync(MIGRATION_KEY);
    if (migrationCompleted === 'true') {
      return false; // Already migrated
    }

    // Check if we have a stored token with store_123
    const existingToken = await SecureStore.getItemAsync('expo_push_token');
    if (!existingToken) {
      return false; // No existing token to migrate
    }

    // Check if we have store_123 in our storage
    const onboardingState = await StorageService.getOnboardingState();
    const hasStore123 = onboardingState?.activeStoreId === 'store_123';
    
    if (hasStore123) {
      console.log('[Migration] Found store_123, clearing for re-registration');
      // Clear the old store_123 so user will be prompted to select a new store
      await StorageService.saveOnboardingState({
        ...onboardingState,
        activeStoreId: null,
      });
      
      // Mark migration as completed
      await SecureStore.setItemAsync(MIGRATION_KEY, 'true');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Migration] Failed to migrate from store_123:', error);
    return false;
  }
}
