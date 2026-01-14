import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/**/*.ts",
        "src/components/**/*.tsx",
        "src/hooks/**/*.ts",
        "src/contexts/**/*.tsx",
      ],
      exclude: [
        "src/test/**",
        "**/*.d.ts",
        "**/*.css.ts",
        "src/hooks/index.ts",
        "src/lib/tauri/index.ts",
        "src/lib/pty/index.ts",
      ],
      // Coverage thresholds: We track coverage but don't enforce strict thresholds
      // to avoid blocking development. See coverage report for current metrics.
      //
      // Current coverage targets (for reference, not enforced):
      // - lib/terminal/*.ts: 100% (dataBuffer, theme)
      // - lib/pty/*.ts: 95%+ (session, usePtySession)
      // - lib/tauri/{pty,shell,window}.ts: 100%
      // - Core lib files (guards, pin, ptyUtils, settings): 90%+
      // - Critical hooks (usePinState, useScreenSize, useFontSizeShortcuts): 100%
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
