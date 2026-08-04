/**
 * hcApi.ts
 * ────────
 * Headcount lookup, backed by AD_GET's /HC/* endpoints (11,923 people, refreshed
 * from HC.xlsx).
 *
 * Why the browser calls this directly instead of going through the IE Pulse
 * backend: AD_GET requires Windows auth. The browser does NTLM for free in the
 * intranet zone; Python would need SSPI, and the backend runs as LocalSystem, so
 * it would authenticate as the machine account rather than a person. Same reason
 * useCurrentUser.ts hits AD_GET directly.
 *
 * The backend therefore never queries AD. It only stores whoever the UI picked
 * (ntid + name + email), which is all the email step needs later.
 *
 * URL, same split as useCurrentUser.ts:
 *   dev  — straight at AD_GET; localhost:3000 is whitelisted in its CORS policy
 *          with AllowCredentials, so NTLM flows.
 *   prod — via nginx, because the page is HTTPS and AD_GET is HTTP: calling it
 *          directly would be blocked as mixed content.
 */

const HC_BASE = import.meta.env.DEV
  ? 'http://mypenm0iesvr02.corp.jabil.org:5110/HC'
  : '/hc';

/** One row of AD_GET's headcount. Only the fields we actually use are typed;
 *  the response carries ~30, including some we deliberately do not surface. */
export interface HcPerson {
  legalName: string | null;
  ntid: string | null;
  email: string | null;
  employeeId: string | null;
  businessTitle: string | null;
  jobCategory: string | null;
  dept: string | null;
  division: string | null;
  customer: string | null;
  costCenter: string | null;
  location: string | null;
  workspace: string | null;
  managerName: string | null;
  managerEmail: string | null;
}

export interface HcSearchResponse {
  total: number;
  offset: number;
  limit: number;
  returned: number;
  results: HcPerson[];
}

async function hcGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  // credentials:'include' is what carries the NTLM handshake.
  const res = await fetch(`${HC_BASE}${path}${qs}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HC ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/** AD_GET returns PascalCase at the envelope level but camelCase inside
 *  `Results`. Normalise the envelope so callers see one shape. */
export const hcApi = {
  search: async (q: string, limit = 25): Promise<HcSearchResponse> => {
    const raw = await hcGet<Record<string, unknown>>('/Search', { q, limit });
    return {
      total: Number(raw.Total ?? raw.total ?? 0),
      offset: Number(raw.Offset ?? raw.offset ?? 0),
      limit: Number(raw.Limit ?? raw.limit ?? limit),
      returned: Number(raw.Returned ?? raw.returned ?? 0),
      results: (raw.Results ?? raw.results ?? []) as HcPerson[],
    };
  },

  /** Exact lookup — AD_GET matches NTID, email OR employee id. */
  person: (key: string) => hcGet<HcPerson>(`/Person/${encodeURIComponent(key)}`),
};

/** "SyedFaizAlhady SyedAhmadAlhady" reads badly in a list. Names in HC are
 *  already spaced properly, so this only tidies the run-together ones. */
export function displayName(p: HcPerson): string {
  return (p.legalName ?? p.ntid ?? '—').trim();
}
