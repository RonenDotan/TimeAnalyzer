module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    'react-native-safe-area-context':
      '<rootDir>/__mocks__/react-native-safe-area-context.tsx',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-safe-area-context)/)',
  ],
};
