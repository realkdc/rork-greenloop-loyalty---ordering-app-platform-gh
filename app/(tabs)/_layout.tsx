import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "@/contexts/AppContext";
import { Ionicons } from "@expo/vector-icons";
import { Store } from "@/config/greenhaus";


export const webviewRefs: Record<string, any> = {
  home: null,
  search: null,
  cart: null,
  orders: null,
  profile: null,
};

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

export default function Layout() {
  const { cartCount } = useApp();

  console.log('[TabLayout] 🎨 Rendering tabs');
  console.log('[TabLayout] 📊 Cart count:', cartCount);
  console.log('[TabLayout] 🎯 Should show badge:', cartCount > 0);
  console.log('[TabLayout] 🔢 Badge value:', cartCount > 99 ? '99+' : cartCount);

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
          console.error('Missing icon config for tab:', name);
          return null;
        }
        
        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: TAB_LABELS[name] || name,
              headerShown: false,
              tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
                const iconName = focused ? iconConfig.filled : iconConfig.outline;
                return (
                  <View style={styles.iconWrapper} testID={`${name}-tab-icon`}>
                    <Ionicons
                      name={iconName}
                      size={size || 24}
                      color={color || "#9ca3af"}
                    />
                    {name === "cart" && cartCount > 0 && (
                      <View style={styles.badge} testID="cart-badge">
                        <Text style={styles.badgeLabel}>
                          {cartCount > 99 ? "99+" : String(cartCount)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              },
            }}
            listeners={{
              tabPress: () => {
                try {
                  const ref = webviewRefs[name];
                  const current = ref?.current;
                  if (current) {
                    if (name === 'home') {
                      console.log(`[Tabs] 🏠 Home tab pressed → navigating to ${Store.HOME}`);
                      const navScript = `
                        (function(){
                          try {
                            const currentUrl = window.location.href;
                            const homeUrl = '${Store.HOME}';
                            console.log('[WebView] Current URL:', currentUrl);
                            console.log('[WebView] Navigating to home:', homeUrl);
                            
                            if (currentUrl.toLowerCase().replace(/\\/$/, '') !== homeUrl.toLowerCase().replace(/\\/$/, '')) {
                              window.location.href = homeUrl;
                            } else {
                              window.scrollTo(0, 0);
                              window.location.reload();
                            }
                          } catch(e) {
                            console.error('[WebView] Navigation error:', e);
                          }
                          return true;
                        })();
                      `;
                      try { current.injectJavaScript(navScript); } catch {}
                      setTimeout(() => {
                        try { current.postMessage(JSON.stringify({ type: 'PING' })); } catch {}
                      }, 300);
                    } else {
                      console.log(`[Tabs] 🔄 tabPress on ${name} → reload + PING`);
                      try { current.postMessage(JSON.stringify({ type: 'TAB_ACTIVE', value: true })); } catch {}
                      try { current.postMessage(JSON.stringify({ type: 'PING' })); } catch {}
                      const targetUrl = TAB_URLS[name];
                      if (targetUrl) {
                        const navigationScript = `
                          (function(){
                            try {
                              const desired = '${targetUrl}';
                              const normalizedDesired = desired.replace(/\\/$/, '');
                              const normalizedCurrent = window.location.href.replace(/\\/$/, '');
                              if (normalizedCurrent !== normalizedDesired) {
                                window.location.href = desired;
                              } else {
                                window.scrollTo(0, 0);
                                window.dispatchEvent(new Event('focus'));
                              }
                            } catch (navError) {
                              console.error('[WebView] Navigation error for ${name}:', navError);
                            }
                            return true;
                          })();
                        `;
                        try { current.injectJavaScript(navigationScript); } catch {}
                      } else {
                        try { current.reload(); } catch {}
                      }
                    }
                  } else {
                    console.log(`[Tabs] ⚠️ No webviewRef for ${name}`);
                  }
                } catch (e) {
                  console.log('[Tabs] tabPress error:', e);
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
