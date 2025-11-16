import AsyncStorage from '@react-native-async-storage/async-storage';

type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

function createAsyncStorageShim(): SecureStoreModule {
  return {
    async getItemAsync(key: string) {
      return AsyncStorage.getItem(key);
    },
    async setItemAsync(key: string, value: string) {
      await AsyncStorage.setItem(key, value);
    },
    async deleteItemAsync(key: string) {
      await AsyncStorage.removeItem(key);
    },
  };
}

let secureStore: SecureStoreModule;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-secure-store');
  secureStore = mod as SecureStoreModule;
} catch {
  // Fallback for environments where the native module isn't available (e.g., some simulator builds)
  secureStore = createAsyncStorageShim();
}

export const SecureStore = secureStore;


