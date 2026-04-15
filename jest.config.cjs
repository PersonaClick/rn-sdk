module.exports = {
  preset: 'react-native',
  rootDir: __dirname,
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-firebase|@notifee|react-native-device-info|axios)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-native-device-info$': '<rootDir>/tests/shims/react-native-device-info.js',
    '^@notifee/react-native$': '<rootDir>/tests/shims/notifee-react-native.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/tests/shims/async-storage.js',
    '^@react-native-firebase/messaging$': '<rootDir>/tests/shims/firebase-messaging.js',
  },
  setupFilesAfterEnv: [],
  testEnvironment: 'node',
  resolver: undefined,
};
