module.exports = {
  preset: 'jest-expo',
  passWithNoTests: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(' +
      'expo|' +
      '@expo|' +
      'expo-router|' +
      'expo-constants|' +
      'expo-linking|' +
      'expo-modules-core|' +
      'expo-status-bar|' +
      'react-native|' +
      '@react-native|' +
      '@react-navigation|' +
      'nativewind|' +
      'react-native-reanimated|' +
      'react-native-safe-area-context|' +
      'react-native-screens' +
    ')/)',
  ],
};
