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

  // "Core" build: VITE_APPS lists more than one module → produce a single
  // bundle that serves the WHOLE IE Pulse shell (every module's routes + the
  // app switcher) mounted at the umbrella /ietools/ base. A normal per-module
  // build uses that module's own /ietools/<module>/ base so each can be
  // deployed independently.
  const coreApps = (env.VITE_APPS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const isCoreBuild = coreApps.length > 1;

  const buildBase = isCoreBuild ? '/ietools/' : (APP_BASENAMES[appId] ?? '/ietools/ole/');

  // Dev always serves at /ietools/ — single dev server, multi-app shell.
  // Each module's routes are namespaced under /ietools/<module>/* via the
  // route paths themselves. Production builds use the per-app base resolved
  // from VITE_APP_ID (or /ietools/ for a core build) so nginx routes correctly.
  const base = command === 'serve' ? '/ietools/' : buildBase;

  return {
    base,
    build: {
      // Per-module builds go to dist/<appId> so they can be deployed
      // independently; the core build goes to dist/all.
      outDir: isCoreBuild ? 'dist/all' : `dist/${appId}`,
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
