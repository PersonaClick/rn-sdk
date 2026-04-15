/** Stub for Jest when `react-native-device-info` is not installed. */
const deviceInfo = {
  getAndroidId: async () => 'jest-android-id',
  syncUniqueId: async () => 'jest-unique-id',
}

export default deviceInfo
