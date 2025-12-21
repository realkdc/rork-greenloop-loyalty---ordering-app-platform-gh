import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Store } from "@/config/greenhaus";
import React from "react";
import { debugLog } from "@/lib/logger";
import { WEBVIEW_MINIMAL_MODE, getPlatformConfig } from "@/constants/config";
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
  const platformConfig = getPlatformConfig();

  debugLog('[TabLayout] 🎨 Rendering tabs');
  debugLog('[TabLayout] 📊 Cart count:', cartCount);
  debugLog('[TabLayout] 🎯 Should show badge:', cartCount > 0);
  debugLog('[TabLayout] 🔢 Badge value:', cartCount > 99 ? '99+' : cartCount);
  debugLog('[TabLayout] 📱 Platform:', Platform.OS, '| Show cart:', platformConfig.showCart);

  // Filter tabs based on platform - hide cart on Android
  debugLog('[TabLayout] 🔍 Platform.OS:', Platform.OS);
  debugLog('[TabLayout] 🔍 platformConfig:', JSON.stringify(platformConfig));

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
      <Tabs.Screen
        name="home"
        options={{
          title: TAB_LABELS.home,
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? TAB_ICONS.home.filled : TAB_ICONS.home.outline;
            return (
              <View style={styles.iconWrapper} testID="home-tab-icon">
                <Ionicons name={iconName} size={size || 24} color={color || "#9ca3af"} />
              </View>
            );
          },
        }}
        listeners={{
          tabPress: () => {
            debugLog('[Tabs] 📱 Tab home pressed');
            trackAnalyticsEvent('VIEW_TAB', { tab: 'Home' }, user?.uid);
            const ref = webviewRefs.home?.current;
            const targetUrl = TAB_URLS.home;
            if (!ref || !targetUrl) return;
            try {
              ref.injectJavaScript(`
                (function(){
                  try {
                    var currentUrl = window.location.href.replace(/\\/$/, '').split('?')[0];
                    var targetUrl = '${targetUrl}'.replace(/\\/$/, '');
                    if (currentUrl === targetUrl) {
                      window.location.reload();
                    } else {
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
              debugLog('[Tabs] ❌ Error navigating home:', e);
            }
          },
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: TAB_LABELS.search,
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? TAB_ICONS.search.filled : TAB_ICONS.search.outline;
            return (
              <View style={styles.iconWrapper} testID="search-tab-icon">
                <Ionicons name={iconName} size={size || 24} color={color || "#9ca3af"} />
              </View>
            );
          },
        }}
        listeners={{
          tabPress: () => {
            debugLog('[Tabs] 📱 Tab search pressed');
            trackAnalyticsEvent('VIEW_TAB', { tab: 'Browse' }, user?.uid);
            const ref = webviewRefs.search?.current;
            const targetUrl = TAB_URLS.search;
            if (!ref || !targetUrl) return;
            try {
              ref.injectJavaScript(`
                (function(){
                  try {
                    var currentUrl = window.location.href.replace(/\\/$/, '').split('?')[0];
                    var targetUrl = '${targetUrl}'.replace(/\\/$/, '');
                    if (currentUrl === targetUrl) {
                      window.location.reload();
                    } else {
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
              debugLog('[Tabs] ❌ Error navigating search:', e);
            }
          },
        }}
      />

      {/* Cart tab - hide on Android */}
      <Tabs.Screen
        name="cart"
        options={{
          title: TAB_LABELS.cart,
          headerShown: false,
          href: platformConfig.showCart ? undefined : null, // null = completely hide from navigation
          tabBarBadge: cartCount > 0 ? (cartCount > 99 ? '99+' : String(cartCount)) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', color: '#fff' },
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? TAB_ICONS.cart.filled : TAB_ICONS.cart.outline;
            return (
              <View style={styles.iconWrapper} testID="cart-tab-icon">
                <Ionicons name={iconName} size={size || 24} color={color || "#9ca3af"} />
              </View>
            );
          },
        }}
        listeners={{
          tabPress: () => {
            debugLog('[Tabs] 📱 Tab cart pressed');
            trackAnalyticsEvent('VIEW_TAB', { tab: 'Cart' }, user?.uid);
            const ref = webviewRefs.cart?.current;
            const targetUrl = TAB_URLS.cart;
            if (!ref || !targetUrl) return;
            try {
              ref.injectJavaScript(`
                (function(){
                  try {
                    var currentUrl = window.location.href.replace(/\\/$/, '').split('?')[0];
                    var targetUrl = '${targetUrl}'.replace(/\\/$/, '');
                    if (currentUrl === targetUrl) {
                      window.location.reload();
                    } else {
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
              debugLog('[Tabs] ❌ Error navigating cart:', e);
            }
          },
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: TAB_LABELS.orders,
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? TAB_ICONS.orders.filled : TAB_ICONS.orders.outline;
            return (
              <View style={styles.iconWrapper} testID="orders-tab-icon">
                <Ionicons name={iconName} size={size || 24} color={color || "#9ca3af"} />
              </View>
            );
          },
        }}
        listeners={{
          tabPress: () => {
            debugLog('[Tabs] 📱 Tab orders pressed');
            trackAnalyticsEvent('VIEW_TAB', { tab: 'Orders' }, user?.uid);
            const ref = webviewRefs.orders?.current;
            const targetUrl = TAB_URLS.orders;
            if (!ref || !targetUrl) return;
            try {
              ref.injectJavaScript(`
                (function(){
                  try {
                    var currentUrl = window.location.href.replace(/\\/$/, '').split('?')[0];
                    var targetUrl = '${targetUrl}'.replace(/\\/$/, '');
                    if (currentUrl === targetUrl) {
                      window.location.reload();
                    } else {
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
              debugLog('[Tabs] ❌ Error navigating orders:', e);
            }
          },
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: TAB_LABELS.profile,
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            const iconName = focused ? TAB_ICONS.profile.filled : TAB_ICONS.profile.outline;
            return (
              <View style={styles.iconWrapper} testID="profile-tab-icon">
                <Ionicons name={iconName} size={size || 24} color={color || "#9ca3af"} />
              </View>
            );
          },
        }}
        listeners={{
          tabPress: () => {
            debugLog('[Tabs] 📱 Tab profile pressed');
            trackAnalyticsEvent('VIEW_TAB', { tab: 'Account' }, user?.uid);
            const ref = webviewRefs.profile?.current;
            const targetUrl = TAB_URLS.profile;
            if (!ref || !targetUrl) return;
            try {
              ref.injectJavaScript(`
                (function(){
                  try {
                    var currentUrl = window.location.href.replace(/\\/$/, '').split('?')[0];
                    var targetUrl = '${targetUrl}'.replace(/\\/$/, '');
                    if (currentUrl === targetUrl) {
                      window.location.reload();
                    } else {
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
              debugLog('[Tabs] ❌ Error navigating profile:', e);
            }
          },
        }}
      />
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
