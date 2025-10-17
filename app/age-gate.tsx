import { View, Text, StyleSheet, TouchableOpacity, Modal, Image } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import colors from '@/constants/colors';
import { StorageService } from '@/services/storage';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AgeGateScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalUrl, setModalUrl] = useState('');

  const handleConfirm = async () => {
    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ageVerified: true,
      state: existing?.state || null,
      stateSupported: existing?.stateSupported || false,
      activeStoreId: existing?.activeStoreId || null,
      completedOnboarding: false,
    });

    console.log('[AGE] confirmed');
    router.replace('/geo-gate');
  };

  const openLegalLink = (url: string) => {
    setModalUrl(url);
    setModalVisible(true);
  };

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/greenhaus-logo.png' }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>Are you 21 or older?</Text>
          <Text style={styles.subtitle}>
            Please confirm you are 21+ years old or a valid medical marijuana patient.
          </Text>

          <Text style={styles.legalText}>
            By confirming, you agree to our{' '}
            <Text style={styles.link} onPress={() => openLegalLink('https://greenhauscc.com/privacy')}>
              Privacy Policy
            </Text>
            {' '}and{' '}
            <Text style={styles.link} onPress={() => openLegalLink('https://greenhauscc.com/terms')}>
              Terms of Service
            </Text>
            .
          </Text>

          <TouchableOpacity 
            style={styles.button}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseButton}
              activeOpacity={0.7}
            >
              <X size={24} color={colors.text} />
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: modalUrl }}
            style={styles.webview}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    marginBottom: 48,
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: 240,
    height: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
    paddingHorizontal: 8,
  },
  legalText: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  link: {
    color: '#1E4D3A',
    fontWeight: '500' as const,
    textDecorationLine: 'underline' as const,
  },
  button: {
    width: '100%',
    height: 54,
    backgroundColor: '#1E4D3A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E4D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'flex-end',
  },
  modalCloseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  webview: {
    flex: 1,
  },
});
