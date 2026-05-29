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
  'cycle-time': '/ietools/cycle-time/',
};

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appId = env.VITE_APP_ID || 'ole';
  const buildBase = APP_BASENAMES[appId] ?? '/ietools/ole/';

  // Dev always serves at /ietools/ — single dev server, multi-app shell.
  // Each module's routes are namespaced under /ietools/<module>/* via the
  // route paths themselves. Production builds still use the per-app base
  // resolved from VITE_APP_ID so nginx routes to the right bundle.
  const base = command === 'serve' ? '/ietools/' : buildBase;

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
        // No /userinfo proxy: NTLM can't be forwarded by Vite's proxy
        // (would 401). Dev calls AD_GET directly via its absolute URL;
        // see USER_INFO_URL in src/hooks/useCurrentUser.ts.
        //
        // OLE FastAPI backend (DuckDB/Parquet OLE mart) is reached only via
        // its specific paths — /ietools/ole/api/* (prod-shaped) and /ole-api/*
        // (dev test page). Everything else under /api/* goes to the MES Hub
        // on :3001, which serves /workcells, /locations, /production,
        // /assemblies, /fsms, /ebuild routes at root.
        '/ietools/ole/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ietools\/ole\/api/, '/api'),
        },
        // Cycle Time module — same backend, different URL prefix.
        // Backend mounts router at /api/cycle-time/* so we rewrite the
        // FE prefix to that.
        '/ietools/cycle-time/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ietools\/cycle-time\/api/, '/api/cycle-time'),
        },
        '/ole-api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ole-api/, ''),
        },
        '/api': {
          target: 'http://localhost:9009',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
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
