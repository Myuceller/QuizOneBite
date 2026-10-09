import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", ".local/**", "out/**", "coverage/**", "next-env.d.ts"]),
  {
    files: ["src/features/quiz/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/server/**", "@/features/quiz/application/**", "@/features/quiz/ports/**"], message: "UI must use public DTOs and API routes, not server implementations." }]
      }]
    }
  }
]);
