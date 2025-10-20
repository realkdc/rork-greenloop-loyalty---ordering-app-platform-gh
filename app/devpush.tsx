import { Redirect, useLocalSearchParams } from "expo-router";
import { DevPushScreen } from "../src/screens/DevPushScreen";

const ALLOWED_FLAG = "1";

export default function DevPushRoute() {
  const params = useLocalSearchParams<{ dev?: string }>();

  if (params.dev !== ALLOWED_FLAG) {
    return <Redirect href="/" />;
  }

  return <DevPushScreen />;
}

