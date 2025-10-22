import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
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
  console.error("🔔 [PUSH] registerPushToken called with:", {
    storeId,
    backendBaseUrl,
    env,
    optedIn,
    isDevice: Device.isDevice,
  });

  if (!Device.isDevice) {
    console.log("Skipping push registration: requires physical device");
    return null;
  }

  if (!backendBaseUrl) {
    console.error("❌ [PUSH] CRITICAL: backend base URL is undefined!");
    console.error("❌ [PUSH] process.env.EXPO_PUBLIC_API_URL =", process.env.EXPO_PUBLIC_API_URL);
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
    const registerUrl = `${normalizedBaseUrl}/push/register`;

    const payload = {
      token,
      deviceOS: Platform.OS,
      env,
      storeId,
      optedIn,
    };

    console.error("🚀 [PUSH] Registering token...");
    console.error("📍 [PUSH] URL:", registerUrl);
    console.error("📦 [PUSH] Payload:", {
      tokenPreview: token.substring(0, 20) + "...",
      deviceOS: Platform.OS,
      env,
      storeId,
      optedIn,
    });

    const response = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read error");
      console.error(`❌ [PUSH] Registration FAILED: ${response.status}/${response.statusText}`);
      console.error(`❌ [PUSH] Error body:`, errorText);
      return null;
    }

    const responseData = await response.json().catch(() => ({}));
    console.error("✅ [PUSH] Registration SUCCESS!");
    console.error("✅ [PUSH] Response:", responseData);
    lastRegistrationTime = now;
    return token;
  } catch (error) {
    console.error("💥 [PUSH] Exception during registration:", error instanceof Error ? error.message : String(error));
    console.error("💥 [PUSH] Full error:", error);
    return null;
  }
};

export default registerPushToken;

