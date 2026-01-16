import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, Component, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity, AppState } from "react-native";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { WebViewProvider } from "@/contexts/WebViewContext";
import { MagicLinkProvider, useMagicLink } from "@/contexts/MagicLinkContext";
import { trpc, trpcClient } from "@/lib/trpc";
import registerPushToken from "@/src/lib/push/registerPushToken";
import { debugLog } from "@/lib/logger";
import { trackAnalyticsEvent } from "@/services/analytics";
import { sessionService } from "@/services/session";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back", gestureEnabled: true, animation: "slide_from_right" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="intro" options={{ headerShown: false }} />
      <Stack.Screen name="splash" options={{ headerShown: false }} />
      <Stack.Screen name="age-gate" options={{ headerShown: false }} />
      <Stack.Screen name="geo-gate" options={{ headerShown: false }} />
      <Stack.Screen name="store-picker" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: true }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ title: "Admin" }} />
      <Stack.Screen name="promos" options={{ title: "Promotions" }} />
      <Stack.Screen 
        name="qr-scanner" 
        options={{ 
          presentation: "modal",
          headerShown: false,
        }} 
      />
    </Stack>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.errorButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 12,
    color: '#000',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#0F4C3A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});

function DeepLinkHandler() {
  const router = useRouter();
  const { pendingMagicLink, setPendingMagicLink } = useMagicLink();

  useEffect(() => {
    if (!pendingMagicLink) {
      return;
    }

    debugLog("🔗 Processing magic link, navigating to profile...");

    router.push("/(tabs)/profile");

    const timer = setTimeout(() => {
      setPendingMagicLink(null);
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [pendingMagicLink, router, setPendingMagicLink]);

  return null;
}

function PushTokenRegistrar() {
  const { selectedStoreId } = useApp();
  const { user } = useAuth();
  const backendBaseUrl = process.env.EXPO_PUBLIC_API_URL;

  // Log when component mounts
  useEffect(() => {
    debugLog("🔔 [PushTokenRegistrar] Component mounted");
    debugLog("🔔 [PushTokenRegistrar] Initial selectedStoreId:", selectedStoreId);
  }, []);

  useEffect(() => {
    debugLog("🎯 [PushTokenRegistrar] Effect triggered");
    debugLog("🎯 [PushTokenRegistrar] selectedStoreId:", selectedStoreId, "type:", typeof selectedStoreId);
    debugLog("🎯 [PushTokenRegistrar] backendBaseUrl:", backendBaseUrl);
    debugLog("🎯 [PushTokenRegistrar] process.env.EXPO_PUBLIC_API_URL:", process.env.EXPO_PUBLIC_API_URL);

    // Only register after store is selected and ready
    if (!selectedStoreId) {
      debugLog("⏸️ [PushTokenRegistrar] Skipping: No store selected yet");
      return;
    }

    debugLog("▶️ [PushTokenRegistrar] ✅ Store ID available! Calling registerPushToken with storeId:", selectedStoreId);
    void registerPushToken({
      storeId: selectedStoreId,
      backendBaseUrl,
      env: "prod",
      optedIn: true,
      userId: user?.uid, // Link push token to user
    });
  }, [backendBaseUrl, selectedStoreId, user?.uid]);

  // Session-based tracking - only fire SESSION_START when session starts
  useEffect(() => {
    const initializeSessionAndTracking = async () => {
      // Initialize session on mount
      const session = await sessionService.initializeSession(user?.uid);

      // Check if this is a new session (not just a component remount)
      if (sessionService.shouldStartNewSession(user?.uid)) {
        const newSession = await sessionService.startNewSession(user?.uid);
        debugLog("🆕 [SessionTracking] New session started:", newSession.sessionId);
        trackAnalyticsEvent('SESSION_START', {}, user?.uid);
      } else {
        debugLog("✅ [SessionTracking] Resuming existing session:", session.sessionId);
        await sessionService.updateActivity();
      }
    };

    initializeSessionAndTracking();

    // Track when app returns to foreground - start new session if timed out
    let previousState = AppState.currentState;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // Only check if transitioning from background/inactive to active
      if (previousState !== 'active' && nextAppState === 'active') {
        debugLog("📱 [SessionTracking] App returned to foreground");

        // Check if we should start a new session (after 30 min timeout)
        if (sessionService.shouldStartNewSession(user?.uid)) {
          const newSession = await sessionService.startNewSession(user?.uid);
          debugLog("🆕 [SessionTracking] New session after timeout:", newSession.sessionId);
          trackAnalyticsEvent('SESSION_START', {}, user?.uid);
        } else {
          debugLog("✅ [SessionTracking] Session still active, updating activity");
          await sessionService.updateActivity();
        }
      }
      previousState = nextAppState;
    });

    return () => subscription.remove();
  }, [user?.uid]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    // Only attempt to load expo-notifications on a physical device.
    // Importing this module in simulators/dev clients can throw when native modules are missing.
    (async () => {
      try {
        const Device = (await import("@/lib/device")).default;
        if (!Device?.isDevice) {
          debugLog("Skipping notifications handler: not a physical device");
          return;
        }
        const mod = await import("expo-notifications");
        if (mod?.setNotificationHandler) {
          mod.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });

          // Track when user taps on a notification
          mod.addNotificationResponseReceivedListener((response) => {
            const { notification } = response;
            trackAnalyticsEvent('PUSH_OPEN', {
              campaignId: notification.request.content.data?.campaignId as string | undefined,
              title: notification.request.content.title as string | undefined,
            });
          });
        }
      } catch {
        debugLog("Skipping notifications handler: expo-notifications not available in this runtime");
      }
    })();

    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        debugLog('Splash screen already hidden');
      }
    };
    hideSplash();
  }, []);

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <AuthProvider>
              <AppProvider>
                <MagicLinkProvider>
                  <WebViewProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <PushTokenRegistrar />
                      <DeepLinkHandler />
                      <RootLayoutNav />
                    </GestureHandlerRootView>
                  </WebViewProvider>
                </MagicLinkProvider>
              </AppProvider>
            </AuthProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
