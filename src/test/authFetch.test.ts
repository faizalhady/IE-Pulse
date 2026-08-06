import { beforeEach, expect, test, vi } from 'vitest';

import { getAuthToken, installAuthFetch } from '@/hooks/useCurrentUser';

/** The bug this guards: AD_GET's token lives 60 minutes, a dashboard tab lives
 *  all day. Without the retry the tab quietly turns into "you have no access"
 *  until someone presses F5. */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let issued = 0;        // how many tokens AD_GET has handed out
let minAccepted = 1;   // anything older than this has "expired"

/** Stands in for AD_GET + the backend. */
const server = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  // AD_GET — matched on the endpoint name, since the URL differs between dev
  // (direct to :5110) and prod (nginx /userinfo/).
  const url = String(input);
  if (/RetrieveUserInfo/i.test(url)) return json({ userNtid: '4033375', token: `tok-${++issued}` });

  const n = Number(new Headers(init?.headers).get('Authorization')?.match(/tok-(\d+)/)?.[1] ?? 0);
  return n >= minAccepted
    ? json({ ntid: '4033375', level: 'developer' })
    : json({ detail: 'Sign-in expired or invalid.' }, 401);
});

const apiCalls = () => server.mock.calls.filter(c => String(c[0]).includes('/api/'));

beforeEach(async () => {
  issued = 0;
  minAccepted = 1;
  server.mockClear();
  vi.stubGlobal('fetch', server);
  installAuthFetch();
  await getAuthToken(true);   // fresh login per test — clears the module cache
});

test('an expired token is re-minted once and the call retried', async () => {
  minAccepted = 2;            // the cached tok-1 just aged out

  const res = await fetch('/ietools/ole/api/access/me/4033375');

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ level: 'developer' });
  expect(issued).toBe(2);     // it actually went back to AD_GET
  expect(apiCalls()).toHaveLength(2);
});

test('a token that is still good is used as-is, no second trip', async () => {
  const res = await fetch('/ietools/ole/api/access/me/4033375');

  expect(res.status).toBe(200);
  expect(issued).toBe(1);
  expect(apiCalls()).toHaveLength(1);
});

test('a genuine 401 is not retried forever', async () => {
  minAccepted = 999;          // nothing will ever be accepted

  const res = await fetch('/ietools/ole/api/access/me/4033375');

  expect(res.status).toBe(401);
  expect(apiCalls()).toHaveLength(2);   // one try, one re-mint. No loop.
});

test('non-API calls never get the Authorization header', async () => {
  await fetch('/userinfo/RetrieveUserInfoNoParam');

  const last = server.mock.calls.at(-1)!;
  expect(new Headers(last[1]?.headers).get('Authorization')).toBeNull();
});
