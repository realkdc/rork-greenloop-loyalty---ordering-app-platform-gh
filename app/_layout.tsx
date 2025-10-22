import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, Component, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { WebViewProvider } from "@/contexts/WebViewContext";
import { MagicLinkProvider, useMagicLink } from "@/contexts/MagicLinkContext";
import { trpc, trpcClient } from "@/lib/trpc";
import registerPushToken from "@/src/lib/push/registerPushToken";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

    console.log("🔗 Processing magic link, navigating to profile...");

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
  const backendBaseUrl = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    console.error("🎯 [PushTokenRegistrar] Effect triggered");
    console.error("🎯 [PushTokenRegistrar] selectedStoreId:", selectedStoreId);
    console.error("🎯 [PushTokenRegistrar] backendBaseUrl:", backendBaseUrl);
    console.error("🎯 [PushTokenRegistrar] process.env.EXPO_PUBLIC_API_URL:", process.env.EXPO_PUBLIC_API_URL);

    // Only register after store is selected and ready
    if (!selectedStoreId) {
      console.error("⏸️ [PushTokenRegistrar] Skipping: No store selected yet");
      return;
    }

    console.error("▶️ [PushTokenRegistrar] Calling registerPushToken...");
    void registerPushToken({
      storeId: selectedStoreId,
      backendBaseUrl,
      env: "prod",
      optedIn: true,
    });
  }, [backendBaseUrl, selectedStoreId]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        console.log('Splash screen already hidden');
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
