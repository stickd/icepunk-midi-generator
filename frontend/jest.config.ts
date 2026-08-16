import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup-after-env.ts'],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': '<rootDir>/__mocks__/styleMock.ts',
    // `tone` is ESM-only and only ever loaded via dynamic import at runtime in a real
    // browser; Jest can't transform its ESM output, so tests get a lightweight stub.
    '^tone$': '<rootDir>/__mocks__/toneMock.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.{ts,tsx}', '**/*.{spec,test}.{ts,tsx}'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/e2e/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/layout.tsx',
  ],
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  // These floors track actual current coverage (~44/39/41/46% as of 2026-07-08) with a
  // small safety margin, so CI catches real regressions instead of always failing.
  // Raise them opportunistically as coverage improves — don't lower them further.
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 35,
      functions: 35,
      lines: 40,
    },
  },
}

export default config
