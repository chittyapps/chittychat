/**
 * Jest Configuration for ChittyChat Platform
 * Supports ES modules, coverage reporting, and performance benchmarks
 */

export default {
  // Use Node's experimental VM modules for ES module support
  testEnvironment: "node",

  // Transform configuration for ES modules
  transform: {},

  // Module file extensions
  moduleFileExtensions: ["js", "json"],

  // Test match patterns
  testMatch: [
    "**/test/**/*.test.js",
    "**/__tests__/**/*.js",
    "**/?(*.)+(spec|test).js",
  ],

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/**/__tests__/**",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/build/**",
  ],

  coverageDirectory: "coverage",

  coverageReporters: ["text", "text-summary", "lcov", "html", "json"],

  // Coverage thresholds (aim for high coverage)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
  },

  // Test timeouts
  testTimeout: 30000, // 30 seconds default
  slowTestThreshold: 10000, // Warn if test takes > 10s

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Globals
  globals: {
    "process.env.NODE_ENV": "test",
  },

  // Setup files
  setupFilesAfterEnv: [],

  // Module name mapper (if needed for path aliases)
  moduleNameMapper: {},

  // Ignore patterns
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/build/",
    "/.wrangler/",
  ],

  // Watch ignore patterns
  watchPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/build/",
    "/.wrangler/",
    "/coverage/",
  ],

  // Force exit after tests complete
  forceExit: true,

  // Max workers for parallel execution
  maxWorkers: "50%",

  // Display individual test results
  displayName: {
    name: "ChittyChat",
    color: "blue",
  },

  // Notify on completion (optional)
  notify: false,
  notifyMode: "failure-change",

  // Error on deprecated APIs
  errorOnDeprecated: true,

  // Detect open handles
  detectOpenHandles: false,

  // Bail after first failure (optional)
  bail: 0,

  // Projects configuration (for multi-project setups)
  projects: undefined,

  // Custom reporters (default only, jest-junit requires separate install)
  reporters: ["default"],
};
