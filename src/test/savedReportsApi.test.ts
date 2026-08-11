/**
 * Guards the URL every module's saved-report client builds.
 *
 * The bug this exists for: Cycle Time was pointed at its own module prefix,
 * /ietools/cycle-time/api. Both nginx and the Vite dev proxy rewrite that to
 * /api/cycle-time/, but saved_reports is a PLATFORM router at /api/saved-reports
 * — so every save 404'd. Only /ietools/ole/api reaches the root /api.
 *
 * Nothing in the type system catches this: the base is just a string, and a
 * wrong one fails at runtime against a server the tests never touch.
 */

import { PLATFORM_API_BASE, savedReports } from '@/lib/shared/savedReportsApi';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let calls: Array<{ url: string; init?: RequestInit }>;

beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
});
afterEach(() => vi.unstubAllGlobals());

const user = { userNtid: '4033375', userName: 'Faiz', userEmail: 'f@j.com' };

describe('savedReports URLs', () => {
  it('every module hits the ROOT /api prefix, not its own module prefix', async () => {
    await savedReports('cycle_time', '4q').list();
    await savedReports('ole', '4q').list();
    await savedReports('ppqt', '4q').list();

    for (const c of calls) {
      expect(c.url.startsWith(`${PLATFORM_API_BASE}/saved-reports`)).toBe(true);
      // The exact shape that 404s. A module-scoped prefix can never reach it.
      expect(c.url).not.toMatch(/\/ietools\/(cycle-time|ppqt|ipk|lbr|fsms)\/api\//);
    }
  });

  it('sends module and report_type as query params on list', async () => {
    await savedReports('cycle_time', '4q').list();
    expect(calls[0].url).toContain('module=cycle_time');
    expect(calls[0].url).toContain('report_type=4q');
  });

  it('POSTs a new save and PUTs an existing one', async () => {
    const api = savedReports('cycle_time', '4q');
    await api.save({ id: null, name: 'n', user, payload: { a: 1 } });
    await api.save({ id: 7, name: 'n', user, payload: { a: 1 } });

    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].url).toMatch(/\/saved-reports$/);
    expect(calls[1].init?.method).toBe('PUT');
    expect(calls[1].url).toMatch(/\/saved-reports\/7$/);
  });

  it('puts module and report_type in the body, and no client-asserted ntid', async () => {
    await savedReports('cycle_time', '4q').save({ id: null, name: 'n', user, payload: {} });
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body).toMatchObject({ module: 'cycle_time', report_type: '4q' });
    // The owner comes from the Bearer token; sending it was the old auth hole.
    expect(body).not.toHaveProperty('owner_ntid');
    expect(calls[0].init?.headers).not.toHaveProperty('X-User-Ntid');
  });
});
