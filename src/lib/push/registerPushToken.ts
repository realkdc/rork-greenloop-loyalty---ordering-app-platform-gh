import Constants from "expo-constants";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

type EasExtra = {
  eas?: {
    projectId?: string;
  };
};

type RegisterPushTokenParams = {
  userId: string;
  storeId: string;
  backendBaseUrl?: string;
  env: "prod" | string;
  optedIn?: boolean;
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

const getAppVersion = (): string | null => {
  return (
    Application.nativeApplicationVersion ??
    Constants.nativeAppVersion ??
    Constants.expoConfig?.version ??
    null
  );
};

const getDeviceName = async (): Promise<string | null> => {
  if (Device.deviceName) {
    return Device.deviceName;
  }

  const maybeGetDeviceNameAsync = (Device as {
    getDeviceNameAsync?: () => Promise<string | null>;
  }).getDeviceNameAsync;

  if (typeof maybeGetDeviceNameAsync === "function") {
    try {
      return await maybeGetDeviceNameAsync();
    } catch (error) {
      console.warn("Failed to resolve device name", error);
    }
  }

  return Device.modelName ?? null;
};

export const registerPushToken = async ({
  userId,
  storeId,
  backendBaseUrl,
  env,
  optedIn,
}: RegisterPushTokenParams): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log("Skipping push registration: requires physical device");
    return null;
  }

  if (!backendBaseUrl) {
    console.warn("Skipping push registration: backend base URL is undefined");
    return null;
  }

  try {
    let { status } = await Notifications.getPermissionsAsync();

    if (status !== Notifications.PermissionStatus.GRANTED) {
      const requestResult = await Notifications.requestPermissionsAsync();
      status = requestResult.status;
    }

    if (status !== Notifications.PermissionStatus.GRANTED) {
      console.log("Push notification permission not granted");
      return null;
    }

    const projectId = getProjectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;

    if (!token) {
      console.warn("Failed to obtain Expo push token");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const normalizedBaseUrl = backendBaseUrl.replace(/\/$/, "");
    const registerUrl = `${normalizedBaseUrl}/v1/push/register`;

    const payload: Record<string, unknown> = {
      token,
      userId,
      storeId,
      platform: Platform.OS,
      deviceName: await getDeviceName(),
      appVersion: getAppVersion(),
      env,
    };

    if (typeof optedIn === "boolean") {
      payload.optedIn = optedIn;
    }

    const response = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn("Failed to register push token", {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    return token;
  } catch (error) {
    console.warn("Error during push token registration", error);
    return null;
  }
};

export default registerPushToken;

