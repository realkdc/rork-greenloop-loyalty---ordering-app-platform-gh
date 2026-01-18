import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Store } from "@/config/greenhaus";
import React, { useRef } from "react";
import { debugLog } from "@/lib/logger";
import { WEBVIEW_MINIMAL_MODE } from "@/constants/config";
import { trackAnalyticsEvent } from "@/services/analytics";


export const webviewRefs: Record<string, any> = {
  home: null,
  search: null,
  cart: null,
  orders: null,
  profile: null,
};
// Throttle rapid reloads (e.g., user tapping a tab repeatedly)
let lastCartReloadAt = 0;

const TAB_ICONS: Record<string, { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }> = {
  home: { outline: "home-outline", filled: "home" },
  search: { outline: "search-outline", filled: "search" },
  cart: { outline: "cart-outline", filled: "cart" },
  orders: { outline: "cube-outline", filled: "cube" },
  profile: { outline: "person-outline", filled: "person" },
};

const TAB_LABELS: Record<string, string> = {
  home: "Home",
  search: "Browse",
  cart: "Cart",
  orders: "Orders",
  profile: "Account",
};

const TAB_URLS: Record<string, string> = {
  home: Store.HOME,
  search: Store.SEARCH,
  cart: Store.CART,
  orders: Store.ORDERS,
  profile: Store.PROFILE,
};

function TabsLayout() {
  // Defensive: if provider hasn't mounted yet, default to 0 to avoid crashes during initial boot
  const app = useApp?.() as ReturnType<typeof useApp> | undefined;
  const { user } = useAuth();
  const cartCount = app?.cartCount ?? 0;

  // Track current tab and when it was opened
  const currentTabRef = useRef<{ name: string; startTime: number } | null>(null);

  debugLog('[TabLayout] 🎨 Rendering tabs');
  debugLog('[TabLayout] 📊 Cart count:', cartCount);
  debugLog('[TabLayout] 🎯 Should show badge:', cartCount > 0);
  debugLog('[TabLayout] 🔢 Badge value:', cartCount > 99 ? '99+' : cartCount);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          overflow: "visible",
        },
        freezeOnBlur: false,
      }}
    >
      {(["home", "search", "cart", "orders", "profile"] as const).map((name) => {
        const isHome = name === "home";
        const iconConfig = TAB_ICONS[name];
        if (!iconConfig) {
          debugLog('Missing icon config for tab:', name);
          return null;
        }
        
        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: TAB_LABELS[name] || name,
              headerShown: false,
              // Native badge as a fallback to ensure cart count is always visible
              ...(name === 'cart'
                ? {
                    tabBarBadge: cartCount > 0 ? (cartCount > 99 ? '99+' : String(cartCount)) : undefined,
                    tabBarBadgeStyle: { backgroundColor: '#ef4444', color: '#fff' },
                  }
                : {}),
              tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
                const iconName = focused ? iconConfig.filled : iconConfig.outline;
                return (
                  <View style={styles.iconWrapper} testID={`${name}-tab-icon`}>
                    <Ionicons
                      name={iconName}
                      size={size || 24}
                      color={color || "#9ca3af"}
                    />
                  </View>
                );
              },
            }}
            listeners={{
              tabPress: () => {
                debugLog(`[Tabs] 📱 Tab ${name} pressed`);

                const now = Date.now();
                const previousTab = currentTabRef.current;
                const toTab = TAB_LABELS[name] || name;

                // Track TAB_SWITCH with duration on previous tab
                if (previousTab) {
                  const duration = Math.floor((now - previousTab.startTime) / 1000);
                  trackAnalyticsEvent('TAB_SWITCH', {
                    from: previousTab.name,
                    to: toTab,
                    duration, // seconds spent on previous tab
                  }, user?.uid);
                } else {
                  // First tab view of the session
                  trackAnalyticsEvent('TAB_SWITCH', {
                    from: null,
                    to: toTab,
                  }, user?.uid);
                }

                // Track current tab
                currentTabRef.current = { name: toTab, startTime: now };

                const ref = webviewRefs[name]?.current;
                const targetUrl = TAB_URLS[name];

                if (!ref || !targetUrl) return;

                try {
                  // Skip navigation for cart tab - let it handle its own state
                  if (name === 'cart') {
                    debugLog(`[Tabs] 🛒 Cart tab pressed - skipping navigation to preserve cart state`);
                    return;
                  }

                  // Navigate to the tab's home URL for other tabs
                  debugLog(`[Tabs] 🔄 Navigating ${name} tab to ${targetUrl}`);
                  ref.injectJavaScript(`
                    (function(){
                      try {
                        var currentUrl = window.location.href.replace(/\\/$/, '').split('?')[0];
                        var targetUrl = '${targetUrl}'.replace(/\\/$/, '');

                        // If already exactly on the target page, reload
                        if (currentUrl === targetUrl) {
                          window.location.reload();
                        } else {
                          // Navigate to the tab's home URL
                          window.location.href = targetUrl;
                        }
                      } catch(e) {
                        console.error('Tab navigation error:', e);
                      }
                      return true;
                    })();
                    true;
                  `);
                } catch (e) {
                  debugLog(`[Tabs] ❌ Error navigating ${name}:`, e);
                }
              },
            }}
          />
        );
      })}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
  },
  badge: {
    position: "absolute",
    top: -8,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 9999,
    elevation: 9999,
  },
  badgeLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700" as const,
    includeFontPadding: false,
  },
});

export default function Layout() {
  return <TabsLayout />;
}
