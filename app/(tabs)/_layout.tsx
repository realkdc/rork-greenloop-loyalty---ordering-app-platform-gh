/* eslint-disable @rork/linters/expo-router-unnecessary-tabs */
import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
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
                  <View style={styles.iconWrapper}>
                    <Ionicons
                      name={iconName}
                      size={size || 24}
                      color={color || "#9ca3af"}
                    />
                    {name === "cart" && cartCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeLabel}>
                          {cartCount > 99 ? "99+" : cartCount}
                        </Text>
                      </View>
                    )}
                  </View>
                );
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
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
