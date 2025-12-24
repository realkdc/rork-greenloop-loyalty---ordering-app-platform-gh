import React, { useRef, useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Alert, Platform, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { webviewRefs } from "./_layout";
import * as Clipboard from "expo-clipboard";

const INJECTED_CSS = `
  /* Hide header and footer */
  header, .ins-header, .site-header,
  footer, .site-footer, .ec-footer,
  nav, .navigation, .site-nav,
  .breadcrumbs, .ec-breadcrumbs {
    display: none !important;
  }

  body {
    padding-top: 20px !important;
  }
`;

const INJECT_SCRIPT = `
  (function() {
    const style = document.createElement('style');
    style.textContent = \`${INJECTED_CSS}\`;
    document.head.appendChild(style);

    // Hide headers, footers, and breadcrumbs
    function hideUIElements() {
      ['header', 'footer', 'nav', '.site-header', '.site-footer', '.ins-header', '.ec-footer', '.breadcrumbs', '.ec-breadcrumbs'].forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          el.style.display = 'none';
        });
      });
    }

    // Run immediately and on DOM changes
    hideUIElements();
    setInterval(hideUIElements, 1000);

    // Watch for DOM changes
    const observer = new MutationObserver(hideUIElements);
    observer.observe(document.body, { childList: true, subtree: true });

    // Magic link detection
    if (typeof window.__ghMagicLinkCooldown === 'undefined') {
      window.__ghMagicLinkCooldown = 0;
    }

    function triggerMagicLinkBanner(source) {
      const now = Date.now();
      if (now - window.__ghMagicLinkCooldown < 3000) {
        console.log('[Auth] Magic link detection suppressed - skipping (' + source + ')');
        return;
      }
      window.__ghMagicLinkCooldown = now;
      console.log('[Auth] Magic link request detected (' + source + ')');

      try {
        window.ReactNativeWebView?.postMessage(JSON.stringify({type:'MAGIC_LINK_REQUESTED', source: source, timestamp: now}));
      } catch(err) {
        console.log('[Auth] Error posting MAGIC_LINK_REQUESTED', err);
      }
    }

    // Watch for button clicks
    document.addEventListener('click', function(e) {
      const target = e.target;
      if (!target) return;

      const text = (target.textContent || '').toLowerCase();
      const href = (target.getAttribute('href') || '').toLowerCase();
      const onclick = (target.getAttribute('onclick') || '').toLowerCase();

      // Check if it's a sign-in link button
      if (
        /get.*sign.*in.*link|send.*sign.*in.*link|magic.*link/i.test(text) ||
        /sign-?in-?link|magic-?link/i.test(href) ||
        /sign-?in|magic-?link/i.test(onclick)
      ) {
        console.log('[Auth] Sign-in link button clicked');
        setTimeout(() => triggerMagicLinkBanner('button-click'), 500);
      }
    }, true);

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const promise = originalFetch.apply(this, args);
      const url = args[0]?.toString() || '';

      if (/sign.*in.*link|magic.*link|auth.*email/i.test(url)) {
        promise.then(response => {
          if (response.ok) {
            setTimeout(() => triggerMagicLinkBanner('fetch'), 500);
          }
          return response;
        }).catch(() => {});
      }

      return promise;
    };
  })();
  true;
`;

export default function OrdersTab() {
  const ref = useRef<WebView>(null);
  webviewRefs.orders = ref;
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPasteButton, setShowPasteButton] = useState(false);
  const [hasError, setHasError] = useState(false);
  const hasAppliedLinkRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUrlRef = useRef<string | null>(null);

  const handleRetry = () => {
    console.log('[Orders] Retry requested');
    setHasError(false);
    setIsLoading(true);
    
    // If we have a pending URL (from a navigation), reload to that
    if (pendingUrlRef.current && ref.current) {
      console.log('[Orders] Reloading to pending URL:', pendingUrlRef.current);
      ref.current.injectJavaScript(`window.location.href = '${pendingUrlRef.current}'; true;`);
    } else {
      ref.current?.reload();
    }
  };

  const handleManualPaste = useCallback(async () => {
    try {
      console.log('[Paste] Starting manual paste...');
      const clipboardContent = await Clipboard.getStringAsync();
      console.log('[Paste] Clipboard content length:', clipboardContent?.length || 0);

      if (!clipboardContent) {
        console.log('[Paste] Clipboard is empty');
        Alert.alert('No Link Found', 'Your clipboard is empty. Please copy the sign-in link from your email first.');
        return;
      }

      // Check if it looks like a magic link
      console.log('[Paste] Checking if link is valid...');
      console.log('[Paste] Contains greenhauscc.com:', clipboardContent.includes('greenhauscc.com'));
      console.log('[Paste] Contains key=:', clipboardContent.includes('key='));

      if (!clipboardContent.includes('greenhauscc.com') || !clipboardContent.includes('key=')) {
        console.log('[Paste] Invalid magic link format');
        Alert.alert(
          'Invalid Link',
          'The clipboard does not contain a valid GreenHaus sign-in link. Please copy the link from your email and try again.'
        );
        return;
      }

      console.log('✅ [Paste] Valid magic link detected');
      console.log('[Paste] Link URL:', clipboardContent.substring(0, 50) + '...');
      hasAppliedLinkRef.current = true;
      setShowPasteButton(false);

      const applyScript = `
        (function(){
          try {
            console.log('[Auth] Starting navigation to magic link');
            const url = '${clipboardContent.replace(/'/g, "\\'")}';
            console.log('[Auth] Target URL:', url.substring(0, 50) + '...');
            window.location.href = url;
            console.log('[Auth] Navigation command executed');
          } catch(e){
            console.error('[Auth] Navigation error:', e);
          }
        })();
        true;
      `;

      console.log('[Paste] Injecting navigation script...');
      ref.current?.injectJavaScript(applyScript);
      console.log('[Paste] Script injected successfully');

      setTimeout(() => {
        hasAppliedLinkRef.current = false;
      }, 10000);
    } catch (error) {
      console.error('[Paste] Error during manual paste:', error);
      Alert.alert('Error', 'Failed to read clipboard. Please try again.');
    }
  }, []);

  const handleOpenMail = useCallback(() => {
    const mailUrl = Platform.select({
      ios: 'message://',
      android: 'content://com.android.email.provider',
      default: 'mailto:',
    });

    Linking.canOpenURL(mailUrl).then((supported) => {
      if (supported) {
        Linking.openURL(mailUrl);
      } else {
        Alert.alert('Cannot Open Mail', 'Please open your mail app manually to get the sign-in link.');
      }
    });
  }, []);

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data || '{}');

      if (msg.type === 'MAGIC_LINK_REQUESTED') {
        console.log('📧 Magic link requested - showing paste button');
        hasAppliedLinkRef.current = false;
        setTimeout(() => {
          setShowPasteButton(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Orders message error:', error);
    }
  }, []);

  return (
    <View style={styles.container}>
      <WebView
        ref={ref}
        source={{ uri: 'https://greenhauscc.com/account/orders' }}
        style={styles.webview}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        javaScriptEnabled
        domStorageEnabled
        pullToRefreshEnabled={true}
        injectedJavaScript={INJECT_SCRIPT}
        onLoadStart={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.log('[Orders] Load started:', nativeEvent.url);
          
          if (nativeEvent.url && nativeEvent.url !== 'about:blank') {
            setIsLoading(true);
            setHasError(false);
            pendingUrlRef.current = nativeEvent.url;
          }

          // Clear any existing timeout
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
          }

          // Set timeout for 20 seconds
          loadingTimeoutRef.current = setTimeout(() => {
            console.log('[Orders] Load timeout - showing retry button');
            setIsLoading(false);
            setRefreshing(false);
            setHasError(true);
          }, 20000);
        }}
        onLoadEnd={() => {
          console.log('[Orders] Load ended');
          
          // Clear timeout since page loaded
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }

          setIsLoading(false);
          setRefreshing(false);
          ref.current?.injectJavaScript(INJECT_SCRIPT);
        }}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress > 0.7) {
            setIsLoading(false);
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[Orders] WebView error:', nativeEvent);
          setIsLoading(false);
          setRefreshing(false);
          if (nativeEvent.description !== 'net::ERR_ABORTED') {
            setHasError(true);
          }
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[Orders] HTTP error:', nativeEvent.statusCode, nativeEvent.url);
          setIsLoading(false);
          setRefreshing(false);
          setHasError(true);
        }}
        onMessage={handleMessage}
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        injectedJavaScriptBeforeContentLoaded={`
          // Patch navigator properties for Cloudflare
          (function() {
            try {
              Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
                configurable: true
              });

              if (!navigator.platform) {
                Object.defineProperty(navigator, 'platform', {
                  get: () => 'Linux armv8l',
                  configurable: true
                });
              }

              if (!navigator.hardwareConcurrency) {
                Object.defineProperty(navigator, 'hardwareConcurrency', {
                  get: () => 8,
                  configurable: true
                });
              }

              if (!navigator.deviceMemory) {
                Object.defineProperty(navigator, 'deviceMemory', {
                  get: () => 8,
                  configurable: true
                });
              }
            } catch (e) {
              console.log('[Orders] Browser API patch error:', e);
            }

            // IMMEDIATELY inject CSS to prevent header/footer flash
            try {
              const style = document.createElement('style');
              style.textContent = \`
                header, footer, nav, 
                .ins-header, .site-header, .site-footer, .ec-footer, 
                .breadcrumbs, .ec-breadcrumbs,
                .navigation, .site-nav,
                #header, #footer {
                  display: none !important;
                  opacity: 0 !important;
                  visibility: hidden !important;
                  height: 0 !important;
                  pointer-events: none !important;
                }
                body { padding-top: 20px !important; }
              \`;
              document.documentElement.appendChild(style);
              
              // Briefly hide body to prevent content flash during initial render
              const hideBody = document.createElement('style');
              hideBody.textContent = 'body { opacity: 0 !important; transition: opacity 0.2s ease; }';
              document.documentElement.appendChild(hideBody);
              
              // Show body after 250ms
              setTimeout(() => {
                hideBody.textContent = 'body { opacity: 1 !important; }';
                setTimeout(() => hideBody.remove(), 200);
              }, 250);

              // Also hide specifically targeted elements as they appear
              const observer = new MutationObserver(() => {
                const targets = document.querySelectorAll('header, footer, nav, .ins-header, .site-header, .site-footer, .ec-footer, .breadcrumbs, .ec-breadcrumbs, #header, #footer');
                targets.forEach(el => {
                  if (el.style.display !== 'none') {
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('opacity', '0', 'important');
                  }
                });
              });
              observer.observe(document.documentElement, { childList: true, subtree: true });
            } catch (e) {}
          })();
          true;
        `}
        renderLoading={() => <View />}
        startInLoadingState={false}
      />

      {isLoading && !hasError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5DB075" />
        </View>
      )}

      {hasError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load orders</Text>
          <Text style={styles.errorSubtext}>Please check your connection and try again</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Tap to Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {showPasteButton && (
        <View style={styles.helperBanner}>
          <View style={styles.textContainer}>
            <Text style={styles.bannerTitle}>📧 Check your email</Text>
            <Text style={styles.bannerText}>Copy the sign-in link, then tap Paste</Text>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.mailButton}
              onPress={handleOpenMail}
            >
              <Text style={styles.mailButtonText}>📬 Mail</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pasteButton}
              onPress={handleManualPaste}
            >
              <Text style={styles.pasteButtonText}>Paste Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => setShowPasteButton(false)}
            >
              <Text style={styles.dismissButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  errorContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#5DB075',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  helperBanner: {
    position: 'absolute',
    top: 180,
    left: 30,
    right: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#1E4D3A',
  },
  textContainer: {
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  bannerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mailButton: {
    backgroundColor: '#1E4D3A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mailButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pasteButton: {
    flex: 1,
    backgroundColor: '#1E4D3A',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pasteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dismissButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    color: '#6B7280',
    fontSize: 22,
    fontWeight: '300',
  },
});
