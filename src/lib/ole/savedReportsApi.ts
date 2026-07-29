/**
 * savedReportsApi.ts — save / load named report content, keyed to the user.
 *
 * Backend: api/routers/saved_reports.py (one generic table, any module).
 * Path note: BASE is /ietools/ole/api, which nginx rewrites to /api — so
 * /ietools/ole/api/saved-reports reaches /api/saved-reports.
 *
 * ⚠️ The NTID is sent by the client, so this is IDENTIFICATION, not
 * AUTHENTICATION — it partitions saves per user, it does not protect them.
 * Fine for report commentary; revisit if anything sensitive is ever stored.
 */

const BASE = '/ietools/ole/api';
const USERINFO_URL = '/userinfo/RetrieveUserInfoNoParam';

export interface UserInfo {
  userName: string;
  userEmail: string;
  userNtid: string;
  department?: string;
  title?: string;
  officeLocation?: string;
}

export interface SavedReportMeta {
  id: number;
  module: string;
  report_type: string;
  name: string;
  owner_ntid: string;
  owner_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedReport<T = unknown> extends SavedReportMeta {
  payload: T;
}

const LOCAL_USER_KEY = 'iepulse.savedReports.localUser';

/**
 * Resolve the current user.
 *
 * In PRODUCTION this just works: /userinfo is same-origin and the browser
 * negotiates Windows auth natively.
 *
 * In DEV it does not. The endpoint is IIS with Windows Integrated Auth and
 * answers 401.2 through the Vite proxy — NTLM is connection-oriented and can't
 * survive the proxy hop. So we fall back to an identity the user sets once,
 * kept in localStorage.
 *
 * ponytail: the fallback exists so the feature is TESTABLE locally. An earlier
 * version returned null and the UI hid itself, which looked exactly like
 * "nothing was built". Degrade, don't disappear.
 */
export async function fetchUserInfo(): Promise<UserInfo | null> {
  try {
    const res = await fetch(USERINFO_URL, { credentials: 'include' });
    if (res.ok) {
      const u = (await res.json()) as UserInfo;
      if (u?.userNtid) return u;
    }
  } catch {
    /* fall through to the local identity */
  }
  return getLocalUser();
}

export function getLocalUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as UserInfo;
    return u?.userNtid ? u : null;
  } catch {
    return null;
  }
}

/** Persist a manually-entered identity (dev fallback). Pass null to clear. */
export function setLocalUser(u: UserInfo | null): void {
  if (u) localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u));
  else localStorage.removeItem(LOCAL_USER_KEY);
}

async function req<T>(path: string, ntid: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-User-Ntid': ntid, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try { detail = (await res.json())?.detail ?? detail; } catch { /* keep status */ }
    throw new Error(`Saved reports: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const savedReportsApi = {
  list: (module: string, reportType: string, ntid: string) =>
    req<SavedReportMeta[]>(
      `/saved-reports?module=${encodeURIComponent(module)}&report_type=${encodeURIComponent(reportType)}`,
      ntid,
    ),

  load: <T>(id: number, ntid: string) => req<SavedReport<T>>(`/saved-reports/${id}`, ntid),

  /**
   * Create a new save, or update an existing one when `id` is given.
   *
   * The id is the identity; the name is only a label. That makes a rename an
   * UPDATE of a known row, so it can't duplicate or silently clobber a
   * same-titled save — which is exactly what name-keyed saving did.
   */
  save: <T>(args: {
    id?: number | null;
    module: string;
    reportType: string;
    name: string;
    user: UserInfo;
    payload: T;
  }) =>
    req<{ id: number; name: string; created_at: string; updated_at: string }>(
      args.id ? `/saved-reports/${args.id}` : '/saved-reports',
      args.user.userNtid,
      {
        method: args.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          module: args.module,
          report_type: args.reportType,
          name: args.name,
          owner_ntid: args.user.userNtid,
          owner_name: args.user.userName,
          owner_email: args.user.userEmail,
          payload: args.payload,
        }),
      },
    ),

  remove: (id: number, ntid: string) =>
    req<{ deleted: number }>(`/saved-reports/${id}`, ntid, { method: 'DELETE' }),
};
