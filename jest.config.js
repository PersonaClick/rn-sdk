module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-native-firebase|react-native-push-notification)/)',
  ],
};
