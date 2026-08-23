/**
 * Off the Jabil network, AD_GET does not resolve. In a DEV build the app then asks the
 * backend for a dev token (one call), remembers the failure instead of retrying on every
 * API call, and every backend call goes out authenticated. Prod builds never do this.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEV_TOKEN = { ntid: '4033375', token: 'dev.jwt.token', fullName: 'Dev (4033375)', expires_in: 28800 };

function responder(calls: string[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url + '|' + (new Headers(init?.headers).get('Authorization') ?? ''));
    if (url.includes('RetrieveUserInfoNoParam')) throw new TypeError('Failed to fetch');        // ERR_NAME_NOT_RESOLVED
    if (url.endsWith('/api/dev/token')) return new Response(JSON.stringify(DEV_TOKEN), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

describe('dev sign-in fallback', () => {
  let calls: string[];
  beforeEach(() => {
    vi.resetModules();
    calls = [];
    vi.stubGlobal('fetch', responder(calls));
    localStorage.removeItem('pulse_dev_token');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to the backend dev token once, then authenticates every backend call', async () => {
    const mod = await import('@/hooks/useCurrentUser');
    mod.installAuthFetch();
    await fetch('/ietools/ask/api/universe/threads');
    await fetch('/ietools/ask/api/universe/threads');
    const userInfo = calls.filter((c) => c.includes('RetrieveUserInfoNoParam')).length;
    const devToken = calls.filter((c) => c.includes('/api/dev/token')).length;
    const threads = calls.filter((c) => c.includes('/threads'));
    expect(userInfo).toBe(1);                                   // one failure, remembered — no storm
    expect(devToken).toBe(1);
    expect(threads).toHaveLength(2);
    expect(threads.every((c) => c.endsWith('|Bearer dev.jwt.token'))).toBe(true);
    expect((await mod.getAuthToken())).toBe('dev.jwt.token');
  });

  it('exposes the dev identity to the app, marked as dev', async () => {
    const mod = await import('@/hooks/useCurrentUser');
    const token = await mod.getAuthToken();
    expect(token).toBe('dev.jwt.token');
    expect(mod.peekUser()?.ntid).toBe('4033375');
    expect(mod.peekUser()?.fullName).toMatch(/dev/i);
  });
});
