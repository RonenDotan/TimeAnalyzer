module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    'react-native-safe-area-context':
      '<rootDir>/__mocks__/react-native-safe-area-context.tsx',
    '@notifee/react-native':
      '<rootDir>/__mocks__/@notifee/react-native.ts',
    '@react-native-async-storage/async-storage':
      '<rootDir>/__mocks__/@react-native-async-storage/async-storage.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-safe-area-context)/)',
  ],
};
