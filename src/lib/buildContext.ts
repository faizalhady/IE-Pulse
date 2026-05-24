/**
 * buildContext.ts
 * ──────────────
 * Runtime info baked at build time from VITE_APP_ID (single) or VITE_APPS (list).
 *
 *  Dev (`npm run dev`)               → BUILD_APPS = [all apps], switcher available.
 *  Build with VITE_APP_ID=ole        → BUILD_APPS = ['ole'], switcher hidden.
 *  Build with VITE_APPS=ole,baseline → BUILD_APPS = ['ole','iebaseline'], switcher shown.
 *
 * Routes for apps not in BUILD_APPS are tree-shaken out of the production bundle.
 */

import { APPS, AppConfig, AppId } from '@/config/apps';

const ALL_APP_IDS: AppId[] = APPS.map(a => a.id);
const ENV_APP_ID  = (import.meta.env.VITE_APP_ID as AppId | undefined);
const ENV_APPS    = (import.meta.env.VITE_APPS    as string | undefined);

function resolveBuildApps(): AppId[] {
  if (import.meta.env.DEV) return ALL_APP_IDS;
  if (ENV_APPS) {
    return ENV_APPS.split(',').map(s => s.trim()).filter(Boolean) as AppId[];
  }
  if (ENV_APP_ID) return [ENV_APP_ID];
  return ALL_APP_IDS; // safety net — should never hit in prod
}

/** Apps included in this bundle. */
export const BUILD_APPS: AppId[] = resolveBuildApps();

/** True only when this bundle contains exactly one app (switcher hidden). */
export const IS_SINGLE_APP: boolean = BUILD_APPS.length === 1;

/** When this bundle is single-app, the config of that app. Else undefined. */
export const BUILD_APP: AppConfig | undefined =
  IS_SINGLE_APP ? APPS.find(a => a.id === BUILD_APPS[0]) : undefined;

/** Convenience predicate for conditionally mounting routes / nav. */
export const includesApp = (id: AppId): boolean => BUILD_APPS.includes(id);

/**
 * BrowserRouter basename — always the umbrella '/ietools/'.
 * The per-module segment ('/ole', '/pulse', etc.) lives in each route's
 * path rather than in the basename, so the module identifier is part of
 * the URL the router actually matches against.
 */
export const BUILD_BASENAME: string = '/ietools/';
