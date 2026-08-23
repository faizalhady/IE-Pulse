/**
 * The app switcher's shape, pinned. It is a 3-column grid grouped by category in array
 * order, so a category string or a moved entry silently changes what the user sees.
 * Faiz's layout, 2026-08-24.
 */

import { APPS, type AppId } from '@/config/apps';
import { LIVE_APPS } from '@/components/layout/AppSwitcher';
import { describe, expect, it } from 'vitest';

const idsIn = (category: string): AppId[] => APPS.filter((a) => a.category === category).map((a) => a.id);

describe('app switcher layout', () => {
  it('puts IE Pulse and Ask in their own section, under Analytics', () => {
    expect(idsIn('Platform')).toEqual(['pulse', 'ask']);
    expect(idsIn('Analytics')).not.toContain('pulse');
    expect(idsIn('Analytics')).not.toContain('ask');
    const categories = [...new Set(APPS.map((a) => a.category))];
    expect(categories.slice(0, 2)).toEqual(['Analytics', 'Platform']);   // sections render in array order
  });

  it('keeps LBR and IPK on the last row of Analytics (3 per row)', () => {
    const analytics = idsIn('Analytics');
    expect(analytics).toHaveLength(6);
    expect(analytics.slice(-3)).toEqual(['va-nva', 'lbr', 'ipk']);
    expect(analytics.slice(0, 3)).toEqual(['ole', 'cycle-time', 'ppqt']);
  });

  it('marks PPQT and VA/NVA live, so their badge is green not amber', () => {
    for (const id of ['ole', 'cycle-time', 'ppqt', 'va-nva'] as AppId[]) {
      expect(LIVE_APPS.has(id)).toBe(true);
    }
    for (const id of ['lbr', 'ipk'] as AppId[]) {
      expect(LIVE_APPS.has(id)).toBe(false);                      // still prototypes — amber is honest
    }
  });
});
