import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const shared = path.resolve(root, "shared/src/index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@app/shared": shared,
    },
  },
  test: {
    environment: "node",
    projects: ["shared", "api", "worker", "stats"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["shared/src/**/*.ts", "api/src/**/*.ts", "worker/src/**/*.ts", "stats/src/**/*.ts"],
      exclude: ["**/*.test.ts", "worker/src/test-jobs.ts"],
      thresholds: {
        lines: 60,
      },
    },
  },
});
