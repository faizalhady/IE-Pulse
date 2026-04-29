import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "::",
    port: 8081,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/ole-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ole-api/, ''),
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
