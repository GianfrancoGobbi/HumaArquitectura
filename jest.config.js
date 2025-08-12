
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
  moduleNameMapper: {
    // If you use CSS modules or import CSS files directly in components:
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy', 
    // For other assets like images:
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  // transform: {
  //   '^.+\\.tsx?$': ['ts-jest', { /* ts-jest config options here */ }]
  // },
  // globals: {
  //   'ts-jest': {
  //     // Optional: specific ts-jest configurations
  //     // diagnostics: false, // Example: disable TypeScript diagnostics during tests
  //   }
  // }
};
