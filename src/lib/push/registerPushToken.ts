import Constants from "expo-constants";
import Device from "@/lib/device";
import { Platform } from "react-native";

type EasExtra = {
  eas?: {
    projectId?: string;
  };
};

type RegisterPushTokenParams = {
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

// Throttle: only register once per 20 seconds
let lastRegistrationTime = 0;
const THROTTLE_MS = 20000;

export const registerPushToken = async ({
  storeId,
  backendBaseUrl,
  env,
  optedIn = true,
}: RegisterPushTokenParams): Promise<string | null> => {
  // Skip immediately on simulators or non-device environments to avoid touching native modules
  if (!Device.isDevice) {
    console.log("Skipping push registration: requires physical device");
    return null;
  }
  // Lazy-require notifications to avoid crashing in dev clients missing the native module
  let Notifications: typeof import("expo-notifications") | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Notifications = require("expo-notifications");
  } catch {
    Notifications = null;
  }

  if (!Notifications) {
    console.log("Skipping push registration: expo-notifications not available in this build");
    return null;
  }

  // Reduce console noise in development

  if (!backendBaseUrl) {
    console.log("[PUSH] Missing backend base URL; skipping");
    return null;
  }

  // Throttle check
  const now = Date.now();
  if (now - lastRegistrationTime < THROTTLE_MS) {
    console.log("PUSH register throttled (20s cooldown)");
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
      console.log("Failed to obtain Expo push token");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const normalizedBaseUrl = backendBaseUrl.replace(/\/$/, "");
    const registerUrl = `${normalizedBaseUrl}/push/register`;

    const payload = {
      token,
      deviceOS: Platform.OS,
      env,
      storeId,
      optedIn,
    };

    // Quiet network call

    const response = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      await response.text().catch(() => "Unable to read error");
      return null;
    }

    const responseData = await response.json().catch(() => ({}));
    // Success (quiet)
    lastRegistrationTime = now;
    return token;
  } catch (error) {
    console.log("[PUSH] Exception during registration:", error instanceof Error ? error.message : String(error));
    return null;
  }
};

export default registerPushToken;

