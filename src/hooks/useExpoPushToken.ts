import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

export type UseExpoPushTokenResult = {
  token: string | null;
  status: PermissionStatus;
  enable: () => Promise<void>;
  isRequesting: boolean;
  lastError: Error | null;
};

export const useExpoPushToken = (): UseExpoPushTokenResult => {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<PermissionStatus>(Notifications.PermissionStatus.UNDETERMINED);
  const [isRequesting, setIsRequesting] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const fetchToken = useCallback(async () => {
    const projectId = getProjectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    return tokenResult.data;
  }, []);

  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      if (!Device.isDevice) {
        if (!isActive) {
          return;
        }

        setStatus("unavailable");
        setLastError(new Error("Push notifications require a physical device."));
        return;
      }

      try {
        const permissions = await Notifications.getPermissionsAsync();

        if (!isActive) {
          return;
        }

        setStatus(permissions.status);

        if (permissions.status === Notifications.PermissionStatus.GRANTED) {
          const existingToken = await fetchToken();

          if (!isActive) {
            return;
          }

          setToken(existingToken);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLastError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void initialize();

    return () => {
      isActive = false;
    };
  }, [fetchToken]);

  const enable = useCallback(async () => {
    if (isRequesting) {
      return;
    }

    if (!Device.isDevice) {
      setStatus("unavailable");
      setLastError(new Error("Push notifications require a physical device."));
      return;
    }

    setIsRequesting(true);
    setLastError(null);

    try {
      let currentStatus = (await Notifications.getPermissionsAsync()).status;

      if (currentStatus !== Notifications.PermissionStatus.GRANTED) {
        currentStatus = (await Notifications.requestPermissionsAsync()).status;
      }

      setStatus(currentStatus);

      if (currentStatus !== Notifications.PermissionStatus.GRANTED) {
        setToken(null);
        return;
      }

      const newToken = await fetchToken();
      setToken(newToken);
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      setLastError(normalizedError);
      console.error("Failed to enable push notifications", normalizedError);
    } finally {
      setIsRequesting(false);
    }
  }, [fetchToken, isRequesting]);

  return useMemo(
    () => ({
      token,
      status,
      enable,
      isRequesting,
      lastError,
    }),
    [enable, isRequesting, lastError, status, token],
  );
};

export default useExpoPushToken;

