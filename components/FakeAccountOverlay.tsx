/**
 * Fake Account Overlay for Apple Review
 * 
 * This component displays fake reviewer account info over the WebView in profile/account views
 * when fake auth is enabled. It overlays on top of the WebView to show "signed in" state.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { LogOut, User, Mail } from 'lucide-react-native';
import { REVIEW_BUILD, REVIEW_DEMO_FAKE_AUTH } from '@/constants/config';
import { FakeAuthService, type FakeSession } from '@/services/fakeAuth';
import Colors from '@/constants/colors';

export const FakeAccountOverlay: React.FC = () => {
  const [session, setSession] = useState<FakeSession | null>(null);

  useEffect(() => {
    if (REVIEW_BUILD && REVIEW_DEMO_FAKE_AUTH) {
      FakeAuthService.getSession().then(setSession);
    }
  }, []);

  if (!REVIEW_BUILD || !REVIEW_DEMO_FAKE_AUTH || !session) {
    return null;
  }

  const handleSignOut = async () => {
    Alert.alert(
      'Demo Mode',
      'Sign out is disabled in demo mode. This is a fake account for App Review only.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <User size={40} color={Colors.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{session.name}</Text>
            <View style={styles.emailRow}>
              <Mail size={14} color="#6B7280" />
              <Text style={styles.email}>{session.email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>
            🎭 Demo Account for App Review
          </Text>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={18} color="#DC2626" />
          <Text style={styles.signOutText}>Sign Out (Disabled)</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          This is a demo-only build for Apple App Review. Account and order data is stored locally for review purposes only.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: '#FFFFFF',
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  demoBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  demoBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  note: {
    marginTop: 12,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
  },
  noteText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});

