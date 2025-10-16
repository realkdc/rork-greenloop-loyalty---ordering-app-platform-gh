/* eslint-disable @rork/linters/expo-router-enforce-safe-area-usage */
/* eslint-disable @rork/linters/expo-router-no-unregistered-tabs-files */
import React, { useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Linking } from "react-native";
import type { WebView } from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import { WebShell } from "@/components/WebShell";
import { webviewRefs } from "./_layout";
import { useFocusEffect } from "@react-navigation/native";
import { Mail, Link2, RotateCcw } from "lucide-react-native";
import Colors from "@/constants/colors";
import { StorageService } from "@/services/storage";
import { useRouter } from "expo-router";
import { AUTH_CONFIG } from "@/config/authConfig";

export default function ProfileTab() {
  const ref = useRef<WebView>(null);
  const router = useRouter();
  const [showPasteButton, setShowPasteButton] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const hasAppliedLinkRef = useRef<boolean>(false);
  
  webviewRefs.profile = ref;

  const validateMagicLink = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      
      const isValidHost = AUTH_CONFIG.magicLinkPatterns.hosts.some(
        host => urlObj.hostname.includes(host)
      );
      
      const hasValidPath = AUTH_CONFIG.magicLinkPatterns.paths.some(
        path => urlObj.pathname.includes(path)
      );
      
      const hasTokenParam = AUTH_CONFIG.magicLinkPatterns.tokenParams.some(
        param => urlObj.searchParams.has(param)
      );
      
      return isValidHost && hasValidPath && hasTokenParam;
    } catch (error) {
      console.log('❌ Invalid URL format:', error);
      return false;
    }
  };

  const applyMagicLink = useCallback((magicUrl: string) => {
    if (!ref.current || hasAppliedLinkRef.current) {
      console.log('❌ Cannot apply link: ref not available or already applied');
      return;
    }

    console.log('🔐 Applying magic link:', magicUrl);
    hasAppliedLinkRef.current = true;
    setShowPasteButton(false);

    const applyScript = `
      (function(){
        try {
          console.log('[Auth] Navigating to magic link');
          const url = '${magicUrl.replace(/'/g, "\\'")}';
          
          window.location.href = url;
          
          console.log('[Auth] Navigation initiated');
        } catch(e){
          console.error('[Auth] Error:', e);
        }
      })();
      true;
    `;

    ref.current.injectJavaScript(applyScript);
    
    setTimeout(() => {
      hasAppliedLinkRef.current = false;
    }, 10000);
  }, []);



  const handleManualPaste = async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync();
      
      if (!clipboardContent) {
        Alert.alert('No Link Found', 'Your clipboard is empty. Please copy the sign-in link from your email first.');
        return;
      }

      if (!validateMagicLink(clipboardContent)) {
        Alert.alert(
          'Invalid Link',
          'The clipboard does not contain a valid GreenHaus sign-in link. Please copy the link from your email and try again.'
        );
        return;
      }

      console.log('✅ Valid magic link from manual paste');
      applyMagicLink(clipboardContent);
      setShowPasteButton(false);
    } catch (error) {
      console.error('Manual paste error:', error);
      Alert.alert('Error', 'Failed to read clipboard. Please try again.');
    }
  };

  const handleOpenMail = () => {
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
  };

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data || '{}');
      
      if (msg.type === 'EMAIL_LINK_SENT') {
        console.log('📧 Email link sent confirmation');
        hasAppliedLinkRef.current = false;
        
        setTimeout(() => {
          setShowPasteButton(true);
        }, 1000);
      }

      if (msg.type === 'LOGIN_SUCCESS') {
        console.log('✅ Login success');
        setShowSuccess(true);
        setShowPasteButton(false);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Profile message error:', error);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      ref.current?.injectJavaScript(`
        (function(){ 
          try{ 
            window.dispatchEvent(new Event('focus')); 
          }catch(e){} 
          true; 
        })();
      `);
      
      return undefined;
    }, [])
  );

  const handleNavigationStateChange = (navState: any) => {
    const url = navState.url || '';
    
    console.log('🌐 Profile nav:', url);
    
    const isAccountPage = url.includes('/account') && !url.includes('/login');
    
    if (isAccountPage && hasAppliedLinkRef.current) {
      setTimeout(() => {
        console.log('✅ On account page after login, checking for user info');
        ref.current?.injectJavaScript(`
          (function(){
            try {
              const hasUser = ${AUTH_CONFIG.successSelectors.map(
                sel => `!!document.querySelector('${sel}')`
              ).join(' || ')};
              
              const bodyText = document.body.innerText || '';
              const hasLogoutText = /log.*out|sign.*out/i.test(bodyText);
              const hasOrdersText = /your.*orders|order.*history/i.test(bodyText);
              const hasWelcomeText = /welcome.*back|hi[,\\s]/i.test(bodyText);
              
              console.log('[Auth] Login check - hasUser:', hasUser, 'hasLogoutText:', hasLogoutText, 'hasOrdersText:', hasOrdersText, 'hasWelcomeText:', hasWelcomeText);
              
              if (hasUser || hasLogoutText || hasOrdersText || hasWelcomeText) {
                window.ReactNativeWebView?.postMessage(JSON.stringify({type:'LOGIN_SUCCESS'}));
              }
            } catch(e){
              console.error('[Auth] Check error:', e);
            }
            true;
          })();
        `);
      }, 2500);
    }
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding',
      'This will clear your onboarding progress and restart the app. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await StorageService.saveOnboardingState({
              ageVerified: false,
              state: null,
              stateSupported: false,
              activeStoreId: null,
              completedOnboarding: false,
            });
            console.log('🔄 Onboarding reset');
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <WebShell
        ref={ref}
        initialUrl={`https://${AUTH_CONFIG.host}/account`}
        tabKey="profile"
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
      />
      
      {showPasteButton && (
        <View style={styles.helperBanner}>
          <Link2 size={20} color={Colors.primary} style={styles.icon} />
          <View style={styles.textContainer}>
            <Text style={styles.bannerTitle}>Got the sign-in link?</Text>
            <Text style={styles.bannerText}>Copy it from your email, then tap Paste</Text>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.mailButton}
              onPress={handleOpenMail}
            >
              <Mail size={18} color="#FFFFFF" />
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
      
      {showSuccess && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✓ Signed in successfully</Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.resetButton}
        onPress={handleResetOnboarding}
      >
        <RotateCcw size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  helperBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  bannerText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mailButton: {
    backgroundColor: Colors.primary,
    padding: 10,
    borderRadius: 8,
  },
  pasteButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pasteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonText: {
    fontSize: 24,
    color: Colors.textLight,
    fontWeight: '400' as const,
  },
  successBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  resetButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
