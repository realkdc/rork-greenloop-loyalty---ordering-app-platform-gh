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
  userId?: string;
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
  userId,
}: RegisterPushTokenParams): Promise<string | null> => {
  console.log("📱 [registerPushToken] Called with params:", { storeId, backendBaseUrl, env, optedIn, userId });
  console.log("📱 [registerPushToken] Device.isDevice:", Device.isDevice);

  // Skip immediately on simulators or non-device environments to avoid touching native modules
  if (!Device.isDevice) {
    console.log("⏭️ [registerPushToken] Skipping push registration: requires physical device");
    return null;
  }
  // Lazy-require notifications to avoid crashing in dev clients missing the native module
  let Notifications: typeof import("expo-notifications") | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Notifications = require("expo-notifications");
    console.log("✅ [registerPushToken] expo-notifications loaded successfully");
  } catch (error) {
    console.log("❌ [registerPushToken] Failed to load expo-notifications:", error);
    Notifications = null;
  }

  if (!Notifications) {
    console.log("⏭️ [registerPushToken] Skipping push registration: expo-notifications not available in this build");
    return null;
  }

  if (!backendBaseUrl) {
    console.log("⚠️ [registerPushToken] Missing backend base URL; skipping");
    return null;
  }

  // Throttle check
  const now = Date.now();
  const timeSinceLastRegistration = now - lastRegistrationTime;
  console.log("⏱️ [registerPushToken] Time since last registration:", timeSinceLastRegistration, "ms (throttle:", THROTTLE_MS, "ms)");

  if (timeSinceLastRegistration < THROTTLE_MS) {
    console.log("🛑 [registerPushToken] THROTTLED - cooldown remaining:", THROTTLE_MS - timeSinceLastRegistration, "ms");
    return null;
  }

  try {
    console.log("🔐 [registerPushToken] Checking permissions...");
    let { status } = await Notifications.getPermissionsAsync();
    console.log("🔐 [registerPushToken] Current permission status:", status);

    if (status !== Notifications.PermissionStatus.GRANTED) {
      console.log("🔐 [registerPushToken] Requesting permissions...");
      const requestResult = await Notifications.requestPermissionsAsync();
      status = requestResult.status;
      console.log("🔐 [registerPushToken] Permission request result:", status);
    }

    if (status !== Notifications.PermissionStatus.GRANTED) {
      console.log("❌ [registerPushToken] Push notification permission not granted");
      return null;
    }

    const projectId = getProjectId();
    console.log("🎫 [registerPushToken] Getting push token with projectId:", projectId);
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data;
    console.log("🎫 [registerPushToken] Obtained token:", token ? `${token.substring(0, 20)}...` : "null");

    if (!token) {
      console.log("❌ [registerPushToken] Failed to obtain Expo push token");
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
      userId,
    };

    console.log("🌐 [registerPushToken] Registering with backend:", registerUrl);
    console.log("🌐 [registerPushToken] Payload:", { ...payload, token: token.substring(0, 20) + "..." });

    const response = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("🌐 [registerPushToken] Backend response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read error");
      console.log("❌ [registerPushToken] Backend error:", errorText);
      return null;
    }

    const responseData = await response.json().catch(() => ({}));
    console.log("✅ [registerPushToken] Successfully registered! Response:", responseData);
    lastRegistrationTime = now;
    return token;
  } catch (error) {
    console.log("❌ [registerPushToken] Exception during registration:", error instanceof Error ? error.message : String(error));
    return null;
  }
};

export default registerPushToken;

