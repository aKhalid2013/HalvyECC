module.exports = {
  preset: 'jest-expo',
  passWithNoTests: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(' +
      'expo|' +
      '@expo|' +
      'expo-router|' +
      'expo-constants|' +
      'expo-linking|' +
      'expo-modules-core|' +
      'expo-status-bar|' +
      'expo-secure-store|' +
      'expo-auth-session|' +
      'expo-web-browser|' +
      'expo-crypto|' +
      'expo-asset|' +
      'react-native|' +
      '@react-native|' +
      '@react-navigation|' +
      'nativewind|' +
      'react-native-reanimated|' +
      'react-native-safe-area-context|' +
      'react-native-screens|' +
      '@supabase|' +
      '@tanstack' +
    ')/)',
  ],
};
