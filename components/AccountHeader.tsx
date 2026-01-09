import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

interface AccountHeaderProps {
  onManageAccount?: () => void;
  customerName?: string | null;
  customerEmail?: string | null;
}

export function AccountHeader({ onManageAccount, customerName, customerEmail }: AccountHeaderProps) {
  const { user } = useAuth();
  
  // Use Lightspeed customer data if available, fallback to local user data
  const displayName = customerName || user?.name || 'Guest';
  let email = customerEmail || user?.email || '';
  
  // Clean email - remove "Edit" and extract just the email part
  if (email) {
    email = email.replace(/Edit$/i, '').trim();
    const emailMatch = email.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch && emailMatch[1]) {
      email = emailMatch[1].trim();
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color="#1E4D3A" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.name}>{displayName}</Text>
          {email ? (
            <Text style={styles.email}>{email}</Text>
          ) : (
            <Text style={styles.guestText}>Guest Account</Text>
          )}
        </View>
      </View>
      {onManageAccount && (
        <TouchableOpacity 
          style={styles.manageButton}
          onPress={onManageAccount}
          activeOpacity={0.7}
        >
          <Text style={styles.manageButtonText}>Manage</Text>
          <Ionicons name="chevron-forward" size={16} color="#1E4D3A" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  guestText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E4D3A',
    marginRight: 4,
  },
});
