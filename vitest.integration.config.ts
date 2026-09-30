import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    include: ["tests/integration/**/*.test.ts"],
    exclude: [],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
