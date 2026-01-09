/**
 * NotificationDebugPanel
 *
 * A simple debug component to test push notifications in-app.
 * Shows the current push token and allows sending test notifications.
 *
 * Usage:
 *   Import and add to any screen:
 *   import NotificationDebugPanel from '@/src/components/NotificationDebugPanel';
 *   <NotificationDebugPanel />
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Clipboard } from 'react-native';
import * as Notifications from 'expo-notifications';
import Device from '@/lib/device';
import Constants from 'expo-constants';

type EasExtra = {
  eas?: {
    projectId?: string;
  };
};

const getProjectId = (): string | undefined => {
  const expoConfig = Constants.expoConfig as { extra?: EasExtra } | undefined;
  if (expoConfig?.extra?.eas?.projectId) {
    return expoConfig.extra.eas.projectId;
  }

  const legacyManifests = Constants as unknown as {
    manifest?: { extra?: EasExtra };
    manifest2?: { extra?: EasExtra };
  };

  return legacyManifests.manifest2?.extra?.eas?.projectId ?? legacyManifests.manifest?.extra?.eas?.projectId;
};

export default function NotificationDebugPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPermissionAndGetToken();
  }, []);

  const checkPermissionAndGetToken = async () => {
    if (!Device.isDevice) {
      setPermissionStatus('simulator');
      return;
    }

    setLoading(true);

    try {
      // Check permission
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);

      // If granted, get token
      if (status === 'granted') {
        const projectId = getProjectId();
        const tokenResult = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        setToken(tokenResult.data);
      }
    } catch (error) {
      console.log('Error getting token:', error);
      Alert.alert('Error', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const requestPermission = async () => {
    if (!Device.isDevice) {
      Alert.alert('Not Available', 'Push notifications only work on physical devices');
      return;
    }

    setLoading(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);

      if (status === 'granted') {
        // Get token after permission granted
        const projectId = getProjectId();
        const tokenResult = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        setToken(tokenResult.data);
        Alert.alert('Success', 'Permission granted! Token obtained.');
      } else {
        Alert.alert('Permission Denied', 'Please enable notifications in device settings');
      }
    } catch (error) {
      console.log('Error requesting permission:', error);
      Alert.alert('Error', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    if (!token) {
      Alert.alert('No Token', 'Cannot send notification without a valid push token');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          title: '🧪 Test from Debug Panel',
          body: 'This notification was sent from the in-app debug panel!',
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          data: {
            type: 'debug_test',
            timestamp: Date.now(),
          },
        }),
      });

      const result = await response.json();
      console.log('Push result:', result);

      if (result.data?.[0]?.status === 'ok') {
        Alert.alert(
          'Notification Sent!',
          'Close the app completely and check your notification tray.\n\nIf you don\'t see it, check:\n• Battery optimization\n• Do Not Disturb mode\n• Notification channel settings'
        );
      } else {
        Alert.alert('Error', `Failed to send: ${result.data?.[0]?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log('Error sending notification:', error);
      Alert.alert('Error', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (token) {
      Clipboard.setString(token);
      Alert.alert('Copied!', 'Push token copied to clipboard');
    }
  };

  if (!Device.isDevice) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔔 Push Notification Debug</Text>
        <Text style={styles.warning}>⚠️ Push notifications only work on physical devices</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Push Notification Debug</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Permission Status:</Text>
        <Text style={[styles.status, permissionStatus === 'granted' ? styles.statusGood : styles.statusBad]}>
          {permissionStatus}
        </Text>
      </View>

      {permissionStatus !== 'granted' && (
        <TouchableOpacity
          style={styles.button}
          onPress={requestPermission}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Request Permission</Text>
          )}
        </TouchableOpacity>
      )}

      {token && (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Push Token:</Text>
            <TouchableOpacity onPress={copyToken} style={styles.tokenContainer}>
              <Text style={styles.token} numberOfLines={2}>
                {token}
              </Text>
              <Text style={styles.copyHint}>Tap to copy</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={sendTestNotification}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send Test Notification</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            💡 Close the app completely after sending to see the notification in your notification tray
          </Text>
        </>
      )}

      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={checkPermissionAndGetToken}
        disabled={loading}
      >
        <Text style={styles.buttonTextSecondary}>Refresh Status</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    margin: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#333',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    fontWeight: '700',
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusGood: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  statusBad: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  tokenContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  token: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  copyHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#666',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  warning: {
    fontSize: 14,
    color: '#856404',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
});
