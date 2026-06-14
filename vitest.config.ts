import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Tests unitarios de lógica pura. Los specs e2e (Playwright) viven en e2e/
    // y se corren con `npm run test:e2e`, no con vitest.
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
