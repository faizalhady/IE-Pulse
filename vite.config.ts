import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

/**
 * App basenames — mirrors src/config/apps.ts.
 * Kept in sync manually; if you rename a basename there, update here too.
 */
const APP_BASENAMES: Record<string, string> = {
  ole: '/ietools/ole/',
  pulse: '/ietools/pulse/',
  fsms: '/ietools/fsms/',
  ebuild: '/ietools/ebuild/',
  iebaseline: '/ietools/iebaseline/',
};

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appId = env.VITE_APP_ID || 'ole';
  const buildBase = APP_BASENAMES[appId] ?? '/ietools/ole/';

  // Dev always serves at /ietools/ole/ — single dev server, multi-app shell.
  // Production builds use the per-app base resolved from VITE_APP_ID.
  const base = command === 'serve' ? '/ietools/ole/' : buildBase;

  return {
    base,
    build: {
      // Each app's production build goes into dist/<appId> so they can be
      // deployed independently without overwriting each other.
      outDir: `dist/${appId}`,
      emptyOutDir: true,
    },
    server: {
      host: "::",
      port: 3000,
      hmr: {
        overlay: false,
      },
      proxy: {
        '/userinfo': {
          target: 'http://mypenm0iesvr02.corp.jabil.org:5110',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/userinfo/, '/User'),
        },
        '/ietools/ole/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ietools\/ole\/api/, '/api'),
        },
        '/ole-api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ole-api/, ''),
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
  };
});
