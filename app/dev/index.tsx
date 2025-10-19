import React from "react";
import { View } from "react-native";
import GetPushTokenButton from "../../src/dev/GetPushTokenButton";

export default function DevTools() {
  return (
    <View style={{ padding: 24, gap: 12 }}>
      <GetPushTokenButton />
    </View>
  );
}
