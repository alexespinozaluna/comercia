import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Data fetching in useEffect is a standard React pattern.
      // Disabling until the app migrates to React 19 `use()` or Suspense boundaries.
      "react-hooks/set-state-in-effect": "off",
      // `const { id, ...rest } = obj` para omitir campos es intencional
      // (CleanJsonId, diffs master-detail): no marcar esos como sin uso.
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker generado por Serwist en el build.
    "public/sw.js",
  ]),
]);

export default eslintConfig;
