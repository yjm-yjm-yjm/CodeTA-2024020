import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        "**/screenshots/**",
        "**/demo-project/**",
        "**/node_modules/**",
        "**/dist/**",
      ],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
