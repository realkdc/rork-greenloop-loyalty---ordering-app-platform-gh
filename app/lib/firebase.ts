import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import Constants from 'expo-constants';

const expoConfig = Constants.expoConfig?.extra || {};

const firebaseConfig = {
  apiKey: expoConfig.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC30WkAUhWaAGDK8-hhm70ajVrGPXRKZBM',
  authDomain: expoConfig.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'greenhaus-app.firebaseapp.com',
  projectId: expoConfig.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'greenhaus-app',
  storageBucket: expoConfig.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'greenhaus-app.firebasestorage.app',
  messagingSenderId: expoConfig.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '253214988919',
  appId: expoConfig.EXPO_PUBLIC_FIREBASE_APP_ID || '1:253214988919:web:c8ddb5fdea61bb197bc472',
};

console.log('[Firebase] Initializing with config:', {
  apiKey: firebaseConfig.apiKey ? '✓ Present' : '✗ Missing',
  authDomain: firebaseConfig.authDomain ? '✓ Present' : '✗ Missing',
  projectId: firebaseConfig.projectId ? '✓ Present' : '✗ Missing',
  storageBucket: firebaseConfig.storageBucket ? '✓ Present' : '✗ Missing',
  messagingSenderId: firebaseConfig.messagingSenderId ? '✓ Present' : '✗ Missing',
  appId: firebaseConfig.appId ? '✓ Present' : '✗ Missing',
});

if (__DEV__) {
  for (const [key, value] of Object.entries(firebaseConfig)) {
    if (!value) {
      console.warn(`[firebase] missing ${key}`);
    }
  }
}

// Safely initialize Firebase with error handling for Android
let app;
let db;

try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('[Firebase] ✅ App initialized successfully');
} catch (error) {
  console.error('[Firebase] ❌ Failed to initialize:', error);
  // Create a minimal fallback to prevent crashes
  // In production, the app will continue to work without Firebase features
  if (getApps().length > 0) {
    app = getApp();
    try {
      db = getFirestore(app);
    } catch (e) {
      console.error('[Firebase] ❌ Failed to get Firestore:', e);
    }
  }
}

export { app, db };
