import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**", "frontend/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "node_modules/",
        "test/",
        "tests/",
        "dist/",
        "**/*.d.ts",
        "**/index.ts",
      ],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
