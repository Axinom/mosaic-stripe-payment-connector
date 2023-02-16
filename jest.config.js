// eslint-disable-next-line @typescript-eslint/no-var-requires
module.exports = {
  preset: 'ts-jest',
  modulePathIgnorePatterns: ['./dist/'],
  setupFilesAfterEnv: ['jest-expect-message'],
  projects: ['<rootDir>/services/**/jest.config.js'],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.stories.tsx',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/vendor/**',
  ],
};
