import { useEffect, useState } from 'react';

// In prod: nginx reverse-proxies /userinfo/ to AD_GET, so the browser sees a
// same-origin HTTPS call (no mixed content, no CORS). In dev: hit AD_GET
// directly so the browser handles NTLM in the intranet zone — Vite's proxy
// can't forward Windows credentials and would 401.
const USER_INFO_URL = import.meta.env.DEV
  ? 'http://mypenm0iesvr02.corp.jabil.org:5110/User/RetrieveUserInfoNoParam'
  : '/userinfo/RetrieveUserInfoNoParam';

export interface CurrentUser {
  ntid: string | null;
  /** Signed by AD_GET; proves `ntid` to the backend. Null when AD_GET has no
   *  secret configured or the caller was not Windows-authenticated. */
  token: string | null;
  fullName: string | null;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  location: string | null;
}

interface ApiUserInfo {
  userName?: string;
  userEmail?: string;
  userNtid?: string;
  token?: string | null;
  department?: string;
  title?: string;
  officeLocation?: string;
}

let cached: CurrentUser | null = null;
let inflight: Promise<CurrentUser> | null = null;
/** When AD_GET last failed. A failure is remembered for a minute so that 40 API calls
 *  do not fire 40 login attempts (off the VPN the name does not even resolve). */
let failedAt = 0;
const FAIL_MEMORY_MS = 60_000;

/** DEV builds only: off the Jabil network the backend mints the token itself
 *  (api/routers/dev_auth.py, present only when PULSE_DEV_NTID is set there).
 *  Any proxied API prefix reaches it; the ask proxy maps /ietools/ask/api → /api. */
const DEV_TOKEN_URL = '/ietools/ask/api/dev/token';

async function devUser(): Promise<CurrentUser | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const res = await fetch(DEV_TOKEN_URL);
    if (!res.ok) return null;
    const d = (await res.json()) as { ntid: string; token: string; fullName?: string };
    return { ntid: d.ntid, token: d.token, fullName: d.fullName ?? `Dev (${d.ntid})`, email: null, department: null, jobTitle: null, location: null };
  } catch {
    return null;
  }
}

async function fetchUser(): Promise<CurrentUser> {
  if (cached) return cached;
  if (inflight) return inflight;
  if (Date.now() - failedAt < FAIL_MEMORY_MS) throw new Error('User info unavailable (recent failure)');
  inflight = fetch(USER_INFO_URL, { credentials: 'include' })
    .then((res) => {
      if (!res.ok) throw new Error(`User info ${res.status}`);
      return res.json();
    })
    .then((data: ApiUserInfo): CurrentUser => {
      const user: CurrentUser = {
        ntid: data.userNtid ?? null,
        token: data.token ?? null,
        fullName: data.userName ?? null,
        email: data.userEmail ?? null,
        department: data.department ?? null,
        jobTitle: data.title ?? null,
        location: data.officeLocation ?? null,
      };
      cached = user;
      return user;
    })
    .catch(async (e: unknown) => {
      const dev = await devUser();
      if (dev) {
        cached = dev;
        return dev;
      }
      failedAt = Date.now();
      throw e;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

/** The identity the app currently holds, if any — no network. */
export function peekUser(): CurrentUser | null {
  return cached;
}

/** The signed token, or null if identity could not be established. Awaits the
 *  in-flight login call rather than racing it, so an API call fired during
 *  startup still goes out authenticated instead of getting a 401.
 *
 *  `force` drops the cache first — for re-minting an expired token. AD_GET's
 *  token lives 60 minutes and tabs live much longer, so this is routine, not
 *  an error path. NTLM re-authenticates silently, so the user sees nothing. */
export async function getAuthToken(force = false): Promise<string | null> {
  if (force) cached = null;
  try {
    return (await fetchUser()).token;
  } catch {
    return null;
  }
}

/** Attach the token to backend calls, once, globally.
 *
 *  A wrapper rather than 44 edited call sites: every fetch in the app goes
 *  through window.fetch anyway, and a call site that forgets the header is a
 *  401 nobody notices until a user hits it.
 *
 *  Only same-origin API paths get the header. AD_GET's own endpoints are
 *  excluded — they authenticate with Windows credentials, and sending the token
 *  to the service that issues it would recurse through fetchUser().
 */
export function installAuthFetch(): void {
  const original = window.fetch.bind(window);
  // Match the API path wherever it sits: prod serves it under
  // /ietools/<app>/api/, dev under /ole-api/api/. Anchoring on '/api/' covers
  // both. AD_GET's own paths are excluded - they use Windows credentials, and
  // calling back into fetchUser() would recurse.
  const isBackendCall = (url: string) =>
    url.includes('/api/') && !url.includes('/userinfo/') && !url.includes('/hc/') && !url.includes('/api/dev/');   // the dev token call must not wait for itself

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
        : input.url;
    if (!isBackendCall(url)) return original(input, init);

    const send = (token: string) => {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set('Authorization', `Bearer ${token}`);
      return original(input, { ...init, headers });
    };

    const token = await getAuthToken();
    if (!token) return original(input, init);   // let the backend answer 401

    const res = await send(token);
    if (res.status !== 401) return res;

    // The token expired mid-session — the tab outlived it. Re-mint once and
    // retry, so a long-open tab keeps working instead of degrading into
    // "you have no access" until someone thinks to press F5.
    const fresh = await getAuthToken(true);
    return fresh && fresh !== token ? send(fresh) : res;
  };
}

/** Split a name on whitespace AND camel-case boundaries, e.g. "SyedFaizAlhady SyedAhmadAlhady" → ["Syed","Faiz","Alhady","Syed","Ahmad","Alhady"]. */
export function splitNameWords(name: string): string[] {
  return name
    .split(/\s+/)
    .flatMap((token) => token.split(/(?=[A-Z])/))
    .filter(Boolean);
}

/** First N words of the camel-split name, joined with spaces. Defaults to 2 (sidebar style). */
export function shortName(name: string, count = 2): string {
  return splitNameWords(name).slice(0, count).join(' ');
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(cached);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    fetchUser()
      .then((u) => { if (alive) setUser(u); })
      .catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, []);

  return { user, error };
}
