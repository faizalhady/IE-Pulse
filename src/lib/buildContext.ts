/**
 * buildContext.ts
 * ──────────────
 * Runtime info baked at build time from VITE_APP_ID.
 *
 *  Dev (`npm run dev`)               → IS_SINGLE_APP = false, all apps + switcher available
 *  Build (`npm run build:ole` etc.)  → IS_SINGLE_APP = true,  locked to one app, switcher hidden
 *
 * The dev fallback uses 'ole' so the basename and active-app default match
 * the dev server's `base: /ietools/ole/`. In dev, you can still switch apps
 * via the AppSwitcher because IS_SINGLE_APP is false.
 */

import { APPS, AppConfig, AppId } from '@/config/apps';

const ENV_APP_ID = (import.meta.env.VITE_APP_ID as AppId | undefined);

/** True when the bundle was built for a single app (production deploys). */
export const IS_SINGLE_APP: boolean = !import.meta.env.DEV && !!ENV_APP_ID;

/** The single-app this build is locked to, or undefined in dev. */
export const BUILD_APP: AppConfig | undefined =
  IS_SINGLE_APP && ENV_APP_ID ? APPS.find(a => a.id === ENV_APP_ID) : undefined;

/** Basename used for the BrowserRouter — derived from the build-time app. */
export const BUILD_BASENAME: string = BUILD_APP?.basename ?? '/ietools/ole/';
