import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Mail, Phone } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_CONFIG } from '@/constants/config';
import Colors from '@/constants/colors';

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signInWithPhone } = useAuth();
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (loading) return;

    setLoading(true);
    try {
      if (method === 'email') {
        if (!email.trim()) {
          alert('Please enter your email');
          return;
        }
        await signIn(email.trim(), name.trim() || undefined);
      } else {
        if (!phone.trim()) {
          alert('Please enter your phone number');
          return;
        }
        await signInWithPhone(phone.trim(), name.trim() || undefined);
      }
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Auth error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to</Text>
            <Text style={styles.brandName}>{BRAND_CONFIG.brandName}</Text>
            <Text style={styles.subtitle}>
              Sign in to start earning rewards
            </Text>
          </View>

          <View style={styles.methodSelector}>
            <TouchableOpacity
              style={[styles.methodButton, method === 'email' && styles.methodButtonActive]}
              onPress={() => setMethod('email')}
            >
              <Mail size={20} color={method === 'email' ? '#FFFFFF' : Colors.text} />
              <Text style={[styles.methodButtonText, method === 'email' && styles.methodButtonTextActive]}>
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodButton, method === 'phone' && styles.methodButtonActive]}
              onPress={() => setMethod('phone')}
            >
              <Phone size={20} color={method === 'phone' ? '#FFFFFF' : Colors.text} />
              <Text style={[styles.methodButtonText, method === 'phone' && styles.methodButtonTextActive]}>
                Phone
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.textLight}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {method === 'email' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 123-4567"
                  placeholderTextColor={Colors.textLight}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Signing in...' : 'Continue'}
              </Text>
            </TouchableOpacity>

            <View style={styles.bonusInfo}>
              <Text style={styles.bonusText}>
                🎁 Get {BRAND_CONFIG.loyalty.welcomeBonus} welcome points!
              </Text>
            </View>
          </View>

          <Text style={styles.disclaimer}>
            By continuing, you agree to our
            <Text style={styles.inlineLink} onPress={() => Linking.openURL('https://greenhaus-site.vercel.app/terms')}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.inlineLink} onPress={() => Linking.openURL('https://greenhaus-site.vercel.app/privacy')}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  brandName: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  methodButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  methodButtonTextActive: {
    color: '#FFFFFF',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  bonusInfo: {
    backgroundColor: Colors.accent + '15',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bonusText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
  },
  inlineLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
