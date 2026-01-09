type DeviceModule = {
  isDevice: boolean;
  osName?: string | null;
  osVersion?: string | null;
};

let Device: DeviceModule;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Device = require('expo-device') as DeviceModule;
} catch {
  Device = {
    isDevice: false,
    osName: null,
    osVersion: null,
  };
}

export default Device;


