/**
 * buildFlags.ts
 * ─────────────
 * Build-time on/off switches read straight from `import.meta.env`.
 *
 * THIS FILE IMPORTS NOTHING, AND THAT IS THE ENTIRE POINT
 *   `CHAT_ENABLED` used to live in `buildContext.ts`, which imports `APPS` from
 *   `config/apps.ts` — and `config/apps.ts` imports the flag back. Both modules
 *   read the other's binding while it is still initialising:
 *
 *     apps.ts:36           import { CHAT_ENABLED } from '@/lib/buildContext'
 *     apps.ts (navItems)   ...(CHAT_ENABLED ? [...] : [])   <- at module eval
 *     buildContext.ts:13   import { APPS } from '@/config/apps'
 *     buildContext.ts:15   APPS.map(...)                    <- at module eval
 *
 *   Whichever module the bundler happened to reach first threw
 *   "Cannot access 'APPS' before initialization" and the app rendered a white
 *   screen — no error boundary, no route, nothing.
 *
 *   A flag that only reads `import.meta.env` has no business depending on the
 *   app registry, so it lives here where nothing can point back at it. Anything
 *   added to this file must keep that property: no imports, ever.
 *
 *   `buildContext` re-exports CHAT_ENABLED so existing importers are unchanged.
 */

/** The cycle-time chatbot surface: nav item, route and floating bubble.
 *
 *  On by default; the FE flag only hides the UI. The server has its own switch
 *  (`CT_CHAT_ENABLED`) and the widget also health-checks before showing itself,
 *  so a hidden bubble and a disabled backend are separate, deliberate states.
 *  Off when the env file says so: VITE_CHAT_ENABLED=0. */
export const CHAT_ENABLED: boolean = import.meta.env.VITE_CHAT_ENABLED !== '0';
