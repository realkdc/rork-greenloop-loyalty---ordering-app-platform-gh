/* eslint-disable @rork/linters/expo-router-unnecessary-tabs */
import { Tabs } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { Ionicons } from "@expo/vector-icons";


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

export default function Layout() {
  const { cartCount } = useApp();

  console.log('[TabLayout] Rendering with cartCount:', cartCount);

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false,
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#9ca3af",
      }}
    >
      {(["home", "search", "cart", "orders", "profile"] as const).map((name) => {
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
              tabBarIcon: ({ focused, color, size }) => {
                const iconName = focused ? iconConfig.filled : iconConfig.outline;
                return (
                  <Ionicons
                    name={iconName}
                    size={size || 24}
                    color={color || "#9ca3af"}
                  />
                );
              },
              tabBarBadge: name === "cart" && cartCount > 0 ? cartCount : undefined,
              tabBarBadgeStyle: {
                backgroundColor: "#22c55e",
                color: "#fff",
                fontSize: 12,
                fontWeight: "600",
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                paddingHorizontal: 4,
              },
            }}

          />
        );
      })}
    </Tabs>
  );
}
