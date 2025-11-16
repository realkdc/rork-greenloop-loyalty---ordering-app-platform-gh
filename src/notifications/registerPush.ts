import Constants from "expo-constants";
// Dynamic import to avoid native module requirement on simulators/dev clients
type NotificationsModule = typeof import("expo-notifications");
let Notifications: NotificationsModule | null = null;
import { Platform } from "react-native";

type EasExtra = {
  eas?: {
    projectId?: string;
  };
};

export type RegisterPushResult = {
  status: import("expo-notifications").PermissionStatus;
  token?: string;
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
  const extra = getExtra();
  return extra?.eas?.projectId;
};

export const registerForPushNotificationsAsync = async (): Promise<RegisterPushResult> => {
  if (!Notifications) {
    try { Notifications = await import("expo-notifications"); } catch { return { status: "granted" as any }; }
  }
  let { status } = await Notifications.getPermissionsAsync();

  if (status !== "granted") {
    const requestResult = await Notifications.requestPermissionsAsync();
    status = requestResult.status;
  }

  if (status !== "granted") {
    return { status };
  }

  const projectId = getProjectId();

  const tokenResult = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const token = tokenResult.data;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return { status, token };
};
