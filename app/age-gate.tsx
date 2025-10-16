import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Leaf, CheckSquare, Square } from 'lucide-react-native';
import colors from '@/constants/colors';
import { StorageService } from '@/services/storage';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AgeGateScreen() {
  const router = useRouter();
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleConfirm = async () => {
    if (!agreedToTerms) {
      Alert.alert('Agreement Required', 'Please agree to the Terms & State Laws to continue.');
      return;
    }

    const existing = await StorageService.getOnboardingState();
    await StorageService.saveOnboardingState({
      ageVerified: true,
      state: existing?.state || null,
      stateSupported: existing?.stateSupported || false,
      activeStoreId: existing?.activeStoreId || null,
      completedOnboarding: false,
    });

    console.log('Age verified, navigating to geo-gate');
    router.replace('/geo-gate');
  };

  const handleExit = () => {
    Alert.alert(
      'Exit App',
      'You must be 21+ to use this app.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Leaf size={56} color={colors.primary} strokeWidth={2.5} />
          </View>

          <Text style={styles.title}>Age Verification</Text>
          <Text style={styles.subtitle}>
            Are you 21+ or a valid medical patient?
          </Text>

          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            activeOpacity={0.7}
          >
            {agreedToTerms ? (
              <CheckSquare size={24} color={colors.primary} />
            ) : (
              <Square size={24} color={colors.textSecondary} />
            )}
            <Text style={styles.checkboxLabel}>
              I agree to the Terms & State Laws
            </Text>
          </TouchableOpacity>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonTextPrimary}>I Confirm</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.buttonSecondary]}
              onPress={handleExit}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonTextSecondary}>Exit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            Loyalty, menu browsing, and order-ahead for pickup.
            {'\n'}
            By continuing, you confirm compliance with local laws.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400' as const,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 26,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  checkboxLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500' as const,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  buttonTextPrimary: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.surface,
  },
  buttonTextSecondary: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  disclaimer: {
    marginTop: 32,
    fontSize: 13,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
});
