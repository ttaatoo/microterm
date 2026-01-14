import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Vite dev server configuration for Tauri
  server: {
    port: 3000,
    strictPort: true,
  },
  // Build configuration for Tauri
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
    // Performance optimizations
    minify: "esbuild",
    rollupOptions: {
      output: {
        // Code splitting for better caching and initial load
        manualChunks: {
          // xterm.js and addons in separate chunk (~600KB)
          xterm: [
            "@xterm/xterm",
            "@xterm/addon-fit",
            "@xterm/addon-search",
            "@xterm/addon-web-links",
            "@xterm/addon-webgl",
          ],
          // Tauri APIs in separate chunk
          tauri: [
            "@tauri-apps/api",
            "@tauri-apps/plugin-global-shortcut",
            "@tauri-apps/plugin-shell",
            "@tauri-apps/plugin-autostart",
          ],
        },
      },
    },
    // Disable source maps in production for smaller bundle size
    sourcemap: false,
  },
});
