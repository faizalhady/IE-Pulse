/**
 * featureFlags.ts
 * ──────────────
 * localStorage-backed feature flags. One source of truth for any UI
 * surface that should be toggleable without a redeploy.
 *
 * Usage:
 *   const enabled = useFeatureFlag('appSwitcher');         // reactive
 *   setFeatureFlag('appSwitcher', true);                   // imperative
 */

import { useSyncExternalStore } from 'react';

export type FeatureFlag = 'appSwitcher';

const DEFAULTS: Record<FeatureFlag, boolean> = {
  appSwitcher: true,
};

const STORAGE_KEY = 'ie-pulse:feature-flags';
const listeners = new Set<() => void>();

function read(): Record<FeatureFlag, boolean> {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function write(state: Record<FeatureFlag, boolean>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach(l => l());
}

export function getFeatureFlag(flag: FeatureFlag): boolean {
  return read()[flag];
}

export function setFeatureFlag(flag: FeatureFlag, value: boolean): void {
  const next = { ...read(), [flag]: value };
  write(next);
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) cb(); };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', onStorage);
      };
    },
    () => read()[flag],
    () => DEFAULTS[flag],
  );
}
