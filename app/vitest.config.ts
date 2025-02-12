import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 10_000,
    hideSkippedTests: true,
    include: ["src/**/*.test.ts"],
    exclude: ["**/mocks/**"],
    setupFiles: ["src/scenes/__tests__/setup.ts"],
  },
});
