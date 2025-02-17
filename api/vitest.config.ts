import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 10_000,
    hideSkippedTests: true,
    include: ["src/**/*.test.ts"],
    exclude: ["**/mocks/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@game/shared": path.resolve(__dirname, "../shared"),
    },
  },
});
