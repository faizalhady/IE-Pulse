/**
 * useEscapeKey.ts
 * ───────────────
 * Subscribes to document keydown while `enabled` is true and fires `callback`
 * when the user presses Escape. Common pattern for modals / drawers.
 */

import { useEffect } from 'react';

export function useEscapeKey(callback: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') callback(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [enabled, callback]);
}
