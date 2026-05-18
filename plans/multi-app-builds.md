# Multi-App Builds — How & Why

This codebase is a **monorepo of multiple apps** (OLE, IE Pulse, FSMS, eBuild,
IE Baseline). All apps share one React project, one Vite config, one
`package.json`. But each app is **deployed as a standalone site** at its own
URL prefix.

## The mental model

```
ONE codebase  →  many build outputs
                  ├── dist/ole/         served at /ietools/ole/
                  ├── dist/pulse/       served at /ietools/pulse/
                  ├── dist/fsms/        served at /ietools/fsms/
                  ├── dist/ebuild/      served at /ietools/ebuild/
                  └── dist/iebaseline/  served at /ietools/iebaseline/
```

Each build is self-contained — its own `index.html`, its own basename, its own
locked active app. You deploy each `dist/<app>` independently behind whatever
reverse proxy (nginx, IIS) routes the URL prefix to the right folder.

## Dev workflow

```
npm run dev
```

- Runs at `http://localhost:8081/ietools/ole/`
- All apps' routes are mounted (you can navigate to any of them)
- The **App Switcher** lives in the sidebar header; turn it on in
  **Settings → Display → Experimental Features**
- Use the switcher to flip between apps while working — it's a real
  in-app navigation, no rebuild needed
- Active app is auto-detected from the URL; localStorage remembers the
  last one across refreshes

## Production build commands

| Command | Output | Basename |
|---|---|---|
| `npm run build`            | `dist/ole/`         | `/ietools/ole/`        |
| `npm run build:ole`        | `dist/ole/`         | `/ietools/ole/`        |
| `npm run build:pulse`      | `dist/pulse/`       | `/ietools/pulse/`      |
| `npm run build:fsms`       | `dist/fsms/`        | `/ietools/fsms/`       |
| `npm run build:ebuild`     | `dist/ebuild/`      | `/ietools/ebuild/`     |
| `npm run build:iebaseline` | `dist/iebaseline/`  | `/ietools/iebaseline/` |

Each command:

1. Reads `.env.<app>` to set `VITE_APP_ID`
2. `vite.config.ts` picks the per-app basename + writes to `dist/<app>/`
3. `src/lib/buildContext.ts` exposes `IS_SINGLE_APP=true` + `BUILD_APP=<app>`
4. `AppContext` locks `activeApp` to that build's app — can't be changed
5. `AppSwitcher` hides itself (no cross-app navigation in production)

## How to deploy

After `npm run build:ole`:

```
dist/ole/
├── index.html        ← references /ietools/ole/assets/...
├── assets/
└── workcell logo/
```

Copy the whole folder to whatever path on the server serves `/ietools/ole/`.
Repeat the build + copy for any other apps you want to publish.

Each deployment is independent. Updating OLE doesn't touch Pulse, and
vice-versa.

## Adding a new app

1. **Define the app** in `src/config/apps.ts`:
   - new entry in `AppId` union
   - new entry in `APPS` array with `basename: '/ietools/<id>/'`
   - list its `navItems`

2. **Mirror the basename** in `vite.config.ts` `APP_BASENAMES` map.

3. **Add the env file** `.env.<id>` with `VITE_APP_ID=<id>`.

4. **Add the build script** in `package.json`:
   ```
   "build:<id>": "node setup-pdfjs-worker.js && vite build --mode <id>",
   ```

5. **Add the pages and routes** in `src/pages/<id>/` and wire them up in `App.tsx`.

That's it. Dev sees the new app in the switcher; `npm run build:<id>` produces
a deployable `dist/<id>/`.

## Why this approach instead of a real monorepo (turborepo / nx)

- One `node_modules`, one config, one CI pipeline — no per-package setup
- Shared components (`@/components/ui/*`) work across apps without
  packaging them as libs
- Cost: every build's bundle contains all apps' code (currently). Tree-shaking
  + route-level code-splitting can trim this later if needed.

## Common pitfalls

- **Forgot to update `vite.config.ts` APP_BASENAMES** when adding an app →
  the build falls back to `/ietools/ole/`. Symptom: deployed app loads
  but assets 404. Fix: add the basename in both `apps.ts` and `vite.config.ts`.
- **Switcher visible in production build** → forgot to hide it. Check
  `IS_SINGLE_APP` is true in the deployed bundle (look at the bundle
  for the embedded `VITE_APP_ID`).
- **Pages from other apps still reachable by typing URL in production** —
  yes, this is currently allowed. The routes are mounted, but no UI links
  to them. If you want hard isolation, gate the `<Route>` definitions on
  `BUILD_APP.id` so only that app's routes mount.
