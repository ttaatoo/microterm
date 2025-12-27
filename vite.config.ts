import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
  },
});
