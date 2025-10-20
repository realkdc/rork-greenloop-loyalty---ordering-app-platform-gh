import { useCallback } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useExpoPushToken } from "../../src/hooks/useExpoPushToken";

const DevPushScreen = () => {
  const { token, status, enable, isRequesting, lastError } = useExpoPushToken();

  const handleEnable = useCallback(() => {
    void enable();
  }, [enable]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 24, gap: 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>Push Notifications (Dev)</Text>
        <Text style={{ fontSize: 14, color: "#444" }}>
          Request Expo push notification permissions and retrieve the Expo push token for testing.
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "600" }}>Permission status</Text>
        <Text style={{ fontSize: 16 }}>{status}</Text>
      </View>

      <TouchableOpacity
        onPress={handleEnable}
        disabled={isRequesting}
        style={{
          alignItems: "center",
          backgroundColor: "#0F4C3A",
          borderRadius: 8,
          opacity: isRequesting ? 0.6 : 1,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
          {isRequesting ? "Requesting..." : "Enable Notifications"}
        </Text>
      </TouchableOpacity>

      {token ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: "600" }}>Expo push token</Text>
          <Text selectable style={{ fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 12 }}>
            {token}
          </Text>
        </View>
      ) : null}

      {lastError ? <Text style={{ color: "#B00020" }}>{lastError.message}</Text> : null}

      <View style={{ gap: 4 }}>
        <Text style={{ color: "#888", fontSize: 12 }}>
          Note: Physical device required for push notifications. Token updates after permission is granted.
        </Text>
      </View>
    </ScrollView>
  );
};

export default DevPushScreen;
