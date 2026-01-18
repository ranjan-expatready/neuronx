export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/core-api/src'],
  testMatch: ['**/__tests__/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@neuronx/adapters/webhooks$':
      '<rootDir>/packages/adapters/webhooks/index.ts',
    '^@neuronx/(.*)$': '<rootDir>/packages/$1/src/index.ts',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testTimeout: 10000,
};
