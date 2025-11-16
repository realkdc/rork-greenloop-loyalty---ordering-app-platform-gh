import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
type NotificationsModule = typeof import("expo-notifications");
let Notifications: NotificationsModule | null = null;
import { registerForPushNotificationsAsync } from "../notifications/registerPush";

export const GetPushTokenButton = () => {
  const [status, setStatus] = useState<any>("unavailable");
  const [token, setToken] = useState<string | undefined>();
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const loadPermission = async () => {
      try {
        if (!Notifications) {
          Notifications = await import("expo-notifications");
        }
        const permissions = await Notifications.getPermissionsAsync();
        setStatus(permissions.status);
      } catch {
        setStatus("unavailable");
      }
    };

    void loadPermission();
  }, []);

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    try {
      const result = await registerForPushNotificationsAsync();
      setStatus(result.status);

      if (result.token) {
        console.log("Expo push token:", result.token);
        setToken(result.token);
      } else {
        setToken(undefined);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCopyToken = async () => {
    if (!token) {
      return;
    }

    await Clipboard.setStringAsync(token);
    Alert.alert("Copied", "Push token copied to clipboard.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Permission status: {status}</Text>

      <TouchableOpacity
        style={[styles.button, isRequesting && styles.buttonDisabled]}
        disabled={isRequesting}
        onPress={handleEnableNotifications}
      >
        <Text style={styles.buttonText}>{isRequesting ? "Requesting..." : "Enable Notifications"}</Text>
      </TouchableOpacity>

      {token ? (
        <View style={styles.tokenContainer}>
          <Text style={styles.tokenLabel}>Expo push token</Text>
          <Text selectable style={styles.tokenValue}>
            {token}
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCopyToken}>
            <Text style={styles.secondaryButtonText}>Copy token</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 24,
  },
  label: {
    fontSize: 16,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#0F4C3A",
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  tokenContainer: {
    gap: 12,
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  tokenValue: {
    fontFamily: "Courier",
    fontSize: 12,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#0F4C3A",
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#0F4C3A",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default GetPushTokenButton;
