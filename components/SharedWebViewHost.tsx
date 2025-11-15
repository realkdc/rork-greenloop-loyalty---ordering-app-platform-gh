import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebShell } from './WebShell';
import { useSharedWebView } from '@/contexts/SharedWebViewContext';
import { useNavigationState } from '@react-navigation/native';

export const SharedWebViewHost: React.FC = () => {
  // ALWAYS call hooks first - never conditionally
  const { webviewRef, currentUrl } = useSharedWebView();
  const navigationState = useNavigationState(state => state);
  
  // Get the actual tab route from the nested navigation structure
  // Try multiple ways to get the current tab name
  const tabsRoute = navigationState?.routes?.[navigationState.index];
  let currentRoute: string | undefined;
  
  // Method 1: Check params.screen (most reliable for expo-router tabs)
  if (tabsRoute?.params && typeof tabsRoute.params === 'object' && 'screen' in tabsRoute.params) {
    currentRoute = tabsRoute.params.screen as string;
  }
  // Method 2: Check nested state routes
  else if (tabsRoute?.state?.routes?.[tabsRoute.state.index || 0]?.name) {
    currentRoute = tabsRoute.state.routes[tabsRoute.state.index || 0].name;
  }
  // Method 3: Check route name directly
  else if (tabsRoute?.name && tabsRoute.name !== '(tabs)') {
    currentRoute = tabsRoute.name;
  }
  
  // Only hide WebView on tabs that DON'T need it (orders, profile/account)
  // Show by default for home, search, cart (and during loading/undefined)
  // Default to showing if we can't determine the route (safety fallback)
  const shouldShowWebView = currentRoute === undefined || (currentRoute !== 'orders' && currentRoute !== 'profile');

  // ALWAYS call useEffect hooks - never conditionally
  useEffect(() => {
    console.log('[SharedWebViewHost] 🌐 Navigation state:', JSON.stringify(navigationState, null, 2));
    console.log('[SharedWebViewHost] 🌐 Tabs route:', tabsRoute);
    console.log('[SharedWebViewHost] 🌐 Current route:', currentRoute, '| Should show:', shouldShowWebView);
  }, [currentRoute, shouldShowWebView, navigationState, tabsRoute]);

  useEffect(() => {
    if (shouldShowWebView) {
      console.log('[SharedWebViewHost] 🎨 Rendering WebView with URL:', currentUrl);
      console.log('[SharedWebViewHost] 🎨 WebView ref available:', !!webviewRef.current);
    }
  }, [currentUrl, webviewRef, shouldShowWebView]);

  // Don't render if WebView should be hidden - but hooks are already called above
  if (!shouldShowWebView) {
    return null;
  }

  return (
    <View style={styles.container} testID="shared-webview-host" collapsable={false}>
      <WebShell
        ref={webviewRef}
        initialUrl={currentUrl}
        tabKey="shared"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0, // Fill entire screen
    backgroundColor: 'transparent', // Transparent - let WebView content show
    zIndex: 0, // Behind buttons/modals
  },
});

