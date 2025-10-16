import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Linking } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { X, Mail } from 'lucide-react-native';
import WebView from 'react-native-webview';
import colors from '@/constants/colors';
import GREENHAUS from '@/greenhaus.config';

interface OtpLoginSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OtpLoginSheet({ visible, onClose, onSuccess }: OtpLoginSheetProps) {
  const loginUrl = `${GREENHAUS.baseUrl}${GREENHAUS.routes.login}`;
  const [loading, setLoading] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (visible) {
      setShowInstructions(false);
    }
  }, [visible]);

  const handleNavigationStateChange = (navState: any) => {
    console.log('Navigation state changed:', navState.url);
    
    if (navState.url.includes('/account') && !navState.url.includes('/login')) {
      console.log('Login successful, detected account URL');
      onSuccess();
      onClose();
    }
    
    if (navState.url.includes('/account/login') && navState.loading === false) {
      setTimeout(() => {
        setShowInstructions(true);
      }, 3000);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Message from WebView:', data);
      
      if (data.type === 'LOGIN_SUCCESS') {
        console.log('Login success message received');
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.log('Message parse error:', error);
    }
  };

  const injectedJavaScript = `
    (function() {
      const observer = new MutationObserver(() => {
        const logoutLink = document.querySelector('a[href*="logout"]');
        const accountName = document.querySelector('[class*="account-name"], [class*="user-name"]');
        
        if (logoutLink || accountName) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'LOGIN_SUCCESS'
          }));
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    })();
    true;
  `;

  const handleOpenEmail = async () => {
    try {
      const canOpen = await Linking.canOpenURL('message://');
      if (canOpen) {
        await Linking.openURL('message://');
      } else {
        await Linking.openURL('mailto:');
      }
    } catch (error) {
      console.error('Failed to open email:', error);
    }
  };

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Link Account</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.7}
          >
            <X size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <WebView
          ref={webViewRef}
          source={{ uri: loginUrl }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          cacheEnabled
          javaScriptEnabled
          domStorageEnabled
          onNavigationStateChange={handleNavigationStateChange}
          onMessage={handleMessage}
          injectedJavaScript={injectedJavaScript}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          style={styles.webview}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {showInstructions && (
          <View style={styles.instructionsOverlay}>
            <ScrollView 
              style={styles.instructionsScroll}
              contentContainerStyle={styles.instructionsContent}
            >
              <View style={styles.instructionsCard}>
                <View style={styles.instructionsIcon}>
                  <Mail size={48} color={colors.primary} />
                </View>
                
                <Text style={styles.instructionsTitle}>Check Your Email</Text>
                <Text style={styles.instructionsText}>
                  We&apos;ve sent you a magic link to log in.
                </Text>
                
                <View style={styles.stepsContainer}>
                  <View style={styles.step}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <Text style={styles.stepText}>Open your email app and find the login link from GreenHaus</Text>
                  </View>
                  
                  <View style={styles.step}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <Text style={styles.stepText}>Long-press the link and select &quot;Copy Link&quot;</Text>
                  </View>
                  
                  <View style={styles.step}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <Text style={styles.stepText}>Come back to this app and paste it in your browser</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.emailButton}
                  onPress={handleOpenEmail}
                  activeOpacity={0.7}
                >
                  <Mail size={20} color="#FFFFFF" />
                  <Text style={styles.emailButtonText}>Open Email App</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.closeInstructionsButton}
                  onPress={() => setShowInstructions(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeInstructionsText}>I&apos;ll check later</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  instructionsOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  instructionsScroll: {
    flex: 1,
  },
  instructionsContent: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  instructionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  instructionsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 24,
    gap: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  closeInstructionsButton: {
    paddingVertical: 12,
  },
  closeInstructionsText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
