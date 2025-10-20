import { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

type PermissionStatus = Notifications.PermissionStatus | "unavailable";

type EasExtra = {
  eas?: {
    projectId?: string;
  };
};

const getExtra = (): EasExtra | undefined => {
  const expoConfig = Constants.expoConfig as { extra?: EasExtra } | undefined;
  if (expoConfig?.extra) {
    return expoConfig.extra;
  }

  const legacyManifests = Constants as unknown as {
    manifest?: { extra?: EasExtra };
    manifest2?: { extra?: EasExtra };
  };

  return legacyManifests.manifest2?.extra ?? legacyManifests.manifest?.extra;
};

const getProjectId = (): string | undefined => {
  return getExtra()?.eas?.projectId;
};

const requestPermissionAndToken = async (): Promise<{
  status: PermissionStatus;
  token: string | null;
}> => {
  if (!Device.isDevice) {
    return { status: "unavailable", token: null };
  }

  let { status } = await Notifications.getPermissionsAsync();

  if (status !== Notifications.PermissionStatus.GRANTED) {
    const requestResult = await Notifications.requestPermissionsAsync();
    status = requestResult.status;
  }

  if (status !== Notifications.PermissionStatus.GRANTED) {
    return { status, token: null };
  }

  const projectId = getProjectId();
  const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return { status, token: tokenResult.data };
};

export const DevPushScreen = () => {
  const [status, setStatus] = useState<PermissionStatus>(Notifications.PermissionStatus.UNDETERMINED);
  const [token, setToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const copyToken = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      await Clipboard.setStringAsync(token);
    } catch (error) {
      console.warn("Failed to copy token", error);
    }
  }, [token]);

  const refreshToken = useCallback(async () => {
    if (isRequesting) {
      return;
    }

    setIsRequesting(true);
    setErrorMessage(null);

    try {
      const result = await requestPermissionAndToken();
      setStatus(result.status);
      setToken(result.token);

      if (result.token) {
        console.log("Expo push token:", result.token);
      } else if (result.status !== Notifications.PermissionStatus.GRANTED) {
        setErrorMessage("Permission not granted. Please allow notifications in settings.");
      }

      if (result.status === "unavailable") {
        setErrorMessage("Push notifications require a physical device.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      console.error("Failed to retrieve push token", error);
    } finally {
      setIsRequesting(false);
    }
  }, [isRequesting]);

  useEffect(() => {
    void refreshToken();
  }, [refreshToken]);

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 20, backgroundColor: "#FFFFFF" }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Developer Push Test</Text>
        <Text style={{ fontSize: 14, color: "#444" }}>
          This screen helps test Expo push notifications on a physical device. Permissions are requested automatically on
          load.
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 14, fontWeight: "600" }}>Permission Status</Text>
        <Text style={{ fontSize: 16 }}>{status}</Text>
      </View>

      <TouchableOpacity
        onPress={() => {
          void refreshToken();
        }}
        disabled={isRequesting}
        style={{
          alignItems: "center",
          backgroundColor: "#0F4C3A",
          borderRadius: 8,
          opacity: isRequesting ? 0.6 : 1,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
          {isRequesting ? "Requesting..." : "Request Permissions & Fetch Token"}
        </Text>
      </TouchableOpacity>

      {token ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: "600" }}>Expo Push Token</Text>
          <Text
            selectable
            style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12, color: "#0B3D2E" }}
          >
            {token}
          </Text>
          <TouchableOpacity
            onPress={() => {
              void copyToken();
            }}
            style={{
              alignItems: "center",
              borderColor: "#0F4C3A",
              borderRadius: 8,
              borderWidth: 1,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: "#0F4C3A", fontSize: 16, fontWeight: "600" }}>Copy Token</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {errorMessage ? <Text style={{ color: "#B00020", fontSize: 14 }}>{errorMessage}</Text> : null}

      <View style={{ gap: 6 }}>
        <Text style={{ color: "#666", fontSize: 12 }}>
          Tip: If you previously denied permissions, open the system Settings to re-enable notifications for this app.
        </Text>
      </View>
    </ScrollView>
  );
};

