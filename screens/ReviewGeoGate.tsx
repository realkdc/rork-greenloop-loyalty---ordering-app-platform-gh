import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useGeoGate } from '@/hooks/useGeoGate';

export function ReviewGeoGate() {
  const { checking, error } = useGeoGate();
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    // Force a reload by reloading the app
    setTimeout(() => {
      // In production, we'd want to trigger a proper location re-check
      // For now, the user can close and reopen the app
      setIsRetrying(false);
    }, 1000);
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.checkingText}>Verifying location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>📍</Text>
        <Text style={styles.title}>Location Verification Required</Text>
        <Text style={styles.message}>
          {error || 'GreenHaus is available only in licensed regions for this review build. Please allow location and try again from Tennessee.'}
        </Text>
        <TouchableOpacity
          style={[styles.button, isRetrying && styles.buttonDisabled]}
          onPress={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Retry Location Check</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.note}>
          This restriction is only active for App Store review builds.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  checkingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  note: {
    marginTop: 24,
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

