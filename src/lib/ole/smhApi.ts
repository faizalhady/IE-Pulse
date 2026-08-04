/**
 * smhApi.ts — CRUD client for SMH values.
 *
 * Backend: api/routers/smh.py, backed by the `smh` SQLite table (not the
 * parquet mart). SMH is the numerator of every OLE number, so writes are
 * restricted to an allowlist server-side.
 *
 * Identity comes from savedReportsApi's fetchUserInfo() — same NTID, same
 * X-User-Ntid header, same dev fallback. Deliberately not a second identity
 * mechanism.
 *
 * ⚠️ A write does NOT change any OLE number until the next pipeline refresh.
 * Every write response carries `pending_refresh: true`; surface it, or users
 * will edit a value, see the dashboard unchanged, and assume it failed.
 */

const BASE = '/ietools/ole/api';

export interface SmhRow {
  workcell: string;
  assembly: string;
  smh_value: number;
  scan_stage: string | null;
  stage_label: string | null;
  plant: string | null;
  source: 'xls' | 'manual';
  updated_by: string | null;
  updated_at: string;
}

export interface SmhAuditRow {
  id: number;
  workcell: string;
  assembly: string;
  action: 'create' | 'update' | 'delete' | 'import';
  old_value: number | null;
  new_value: number | null;
  changed_by: string | null;
  changed_at: string;
}

export interface SmhWriteResult {
  pending_refresh: boolean;
  row?: SmhRow;
}

export interface SmhImportResult extends SmhWriteResult {
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
}

async function req<T>(path: string, init: RequestInit = {}, ntid?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(ntid ? { 'X-User-Ntid': ntid } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    // The backend's `detail` is written to be shown to the user verbatim
    // ("You do not have permission…", "must be greater than 0"). Surfacing a
    // bare status code instead would waste that.
    let detail = `Request failed (${res.status})`;
    try { detail = (await res.json())?.detail ?? detail; } catch { /* keep status */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

/** Path segments — assembly numbers can contain slashes. */
const seg = (s: string) => encodeURIComponent(s);

export const smhApi = {
  list: (params?: { workcell?: string; search?: string }) => {
    const p = new URLSearchParams();
    if (params?.workcell && params.workcell !== 'all') p.set('workcell', params.workcell);
    if (params?.search) p.set('search', params.search);
    return req<SmhRow[]>(`/smh${p.toString() ? `?${p}` : ''}`);
  },

  history: (params?: { workcell?: string; assembly?: string; limit?: number }) => {
    const p = new URLSearchParams();
    if (params?.workcell) p.set('workcell', params.workcell);
    if (params?.assembly) p.set('assembly', params.assembly);
    if (params?.limit) p.set('limit', String(params.limit));
    return req<SmhAuditRow[]>(`/smh/history${p.toString() ? `?${p}` : ''}`);
  },

  /** Ask the backend, don't duplicate the allowlist in the UI. */
  canEdit: (ntid: string) =>
    req<{ can_edit: boolean }>('/smh/can-edit', {}, ntid),

  create: (row: { workcell: string; assembly: string; smh_value: number }, ntid: string) =>
    req<SmhWriteResult>('/smh', { method: 'POST', body: JSON.stringify(row) }, ntid),

  update: (workcell: string, assembly: string, smh_value: number, ntid: string) =>
    req<SmhWriteResult>(`/smh/${seg(workcell)}/${seg(assembly)}`,
      { method: 'PUT', body: JSON.stringify({ smh_value }) }, ntid),

  remove: (workcell: string, assembly: string, ntid: string) =>
    req<SmhWriteResult>(`/smh/${seg(workcell)}/${seg(assembly)}`, { method: 'DELETE' }, ntid),

  importXls: (workcell: string, file: File, ntid: string) => {
    const fd = new FormData();
    fd.append('workcell', workcell);
    fd.append('file', file);
    return req<SmhImportResult>('/smh/import', { method: 'POST', body: fd }, ntid);
  },
};
