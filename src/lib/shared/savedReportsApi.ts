/**
 * savedReportsApi.ts — save / load named report content, keyed to the user.
 *
 * Backend: api/routers/saved_reports.py — ONE generic table, any module.
 * Shared, not OLE-only: OLE 4Q, Cycle Time 4Q and anything after them all write
 * to the same table, separated by (module, report_type).
 *
 * AUTH: the caller's identity comes from the Bearer token, which
 * installAuthFetch() (hooks/useCurrentUser.ts) attaches to every /api/ call.
 * Nothing here sends an NTID — an earlier version sent X-User-Ntid and an
 * owner_ntid body field, both client-asserted, which let a caller read or
 * overwrite anyone's saves by naming them. The backend now takes the owner from
 * the token and ignores the body field.
 */

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

/**
 * The prefix that reaches the backend's ROOT /api, which is where the
 * platform-wide routers live.
 *
 * ⚠️ It is named "ole" and that is not a mistake. Every other module prefix is
 * scoped to its own router:
 *
 *     /ietools/ole/api/         → :9007/api/              ← root, what we need
 *     /ietools/cycle-time/api/  → :9007/api/cycle-time/   ← module-scoped
 *     /ietools/ppqt/api/        → :9007/api/ppqt/
 *
 * (fastapi.conf on mypenm0iesvr02 :176 and :209; the Vite dev proxy in
 * vite.config.ts mirrors it.) So calling /ietools/cycle-time/api/saved-reports
 * resolves to /api/cycle-time/saved-reports, which does not exist — a 404 on
 * every save. saved_reports is ONE table shared by every module, mounted at
 * /api/saved-reports, so it can only be reached through this prefix.
 *
 * To fix it properly, add a platform-neutral `/ietools/api/ → :9007/api/` to
 * nginx AND to the dev proxy, then change this one constant. Until then every
 * module points here on purpose.
 */
export const PLATFORM_API_BASE = '/ietools/ole/api';

const USERINFO_URL = '/userinfo/RetrieveUserInfoNoParam';
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
 *
 * ponytail: hooks/useCurrentUser.ts has a second, better identity path — cached,
 * deduped, and pointed straight at AD_GET in dev so it needs no localStorage
 * fallback at all. Collapsing the two is a behaviour change for OLE, so it is
 * deliberately NOT bundled into this move. Do it on its own.
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

async function req<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try { detail = (await res.json())?.detail ?? detail; } catch { /* keep status */ }
    throw new Error(`Saved reports: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface SavedReportsClient {
  list(): Promise<SavedReportMeta[]>;
  load<T>(id: number): Promise<SavedReport<T>>;
  save<T>(args: { id?: number | null; name: string; user: UserInfo; payload: T }):
    Promise<{ id: number; name: string; created_at: string; updated_at: string }>;
  remove(id: number): Promise<{ deleted: number }>;
}

/**
 * Build a client bound to one (module, report_type) pair — a given report page
 * only ever talks to its own kind.
 *
 * Create it at module scope, not in a render: the returned object is a new
 * identity each call and would defeat any memo it lands in.
 *
 *   const api = savedReports('cycle_time', '4q');
 *
 * `base` exists only so a caller on a differently-proxied host can override it;
 * see PLATFORM_API_BASE for why the default is what it is.
 */
export function savedReports(
  module: string, reportType: string, base: string = PLATFORM_API_BASE,
): SavedReportsClient {
  const q = `module=${encodeURIComponent(module)}&report_type=${encodeURIComponent(reportType)}`;

  return {
    list: () => req<SavedReportMeta[]>(`${base}/saved-reports?${q}`),

    load: <T>(id: number) => req<SavedReport<T>>(`${base}/saved-reports/${id}`),

    /**
     * Create a new save, or update an existing one when `id` is given.
     *
     * The id is the identity; the name is only a label. That makes a rename an
     * UPDATE of a known row, so it can't duplicate or silently clobber a
     * same-titled save — which is exactly what name-keyed saving did.
     *
     * owner_name / owner_email are still sent: the backend stores them from the
     * body. Only owner_ntid moved to the token.
     */
    save: <T>(args: { id?: number | null; name: string; user: UserInfo; payload: T }) =>
      req<{ id: number; name: string; created_at: string; updated_at: string }>(
        args.id ? `${base}/saved-reports/${args.id}` : `${base}/saved-reports`,
        {
          method: args.id ? 'PUT' : 'POST',
          body: JSON.stringify({
            module,
            report_type: reportType,
            name: args.name,
            owner_name: args.user.userName,
            owner_email: args.user.userEmail,
            payload: args.payload,
          }),
        },
      ),

    remove: (id: number) => req<{ deleted: number }>(`${base}/saved-reports/${id}`, { method: 'DELETE' }),
  };
}
