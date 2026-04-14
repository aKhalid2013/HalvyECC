module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.integration.test.ts?(x)'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
