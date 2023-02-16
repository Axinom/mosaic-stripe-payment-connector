module.exports = {
  preset: 'ts-jest',
  modulePathIgnorePatterns: ['./dist/', './legacy/'],
  setupFilesAfterEnv: ['jest-expect-message'],
  displayName: 'stripe-payment-connector',
  testEnvironment: 'node',
};
