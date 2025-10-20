import { View } from "react-native";
import GetPushTokenButton from "../../src/dev/GetPushTokenButton";

const DevPushScreen = () => {
  return (
    <View style={{ padding: 24, gap: 12 }}>
      <GetPushTokenButton />
    </View>
  );
};

export default DevPushScreen;
