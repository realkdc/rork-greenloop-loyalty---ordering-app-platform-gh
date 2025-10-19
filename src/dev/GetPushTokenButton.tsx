import React from "react";
import { Alert, Button, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";

export default function GetPushTokenButton() {
  const onPress = async () => {
    try {
      if (Platform.OS === "ios" && !Constants.isDevice) {
        Alert.alert("Simulator can’t receive pushes", "Install on a real iPhone or TestFlight.");
        return;
      }
      const perm = await Notifications.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Push not allowed", "Enable notifications in Settings.");
        return;
      }
      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId: Constants?.expoConfig?.extra?.eas?.projectId
          ?? Constants?.easConfig?.projectId
      });
      await Clipboard.setStringAsync(data);
      Alert.alert("Expo push token (copied)", data);
      console.log("[PUSH] Expo token:", data);
    } catch (e: any) {
      console.log("[PUSH] token error:", e?.message ?? e);
      Alert.alert("Token error", String(e?.message ?? e));
    }
  };
  return <Button title="Get Push Token" onPress={onPress} />;
}
