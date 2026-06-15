/**
 * mockSubmissionsData.ts — mock data + view-model for the FSMS Submissions page.
 * ──────────────────────────────────────────────────────────────────────────────
 * Combines the legacy upload + batches(approvals) flows into one lifecycle:
 *   Upload → staged Request (batch) → Approval flow → Promoted / Rejected.
 *
 * Only CONSO is approval-gated (4 required approvers). REVENUE / PRISM / RATE are
 * direct imports (no approval) — they land at "Imported".
 *
 * Auth is mocked: MOCK_CURRENT_USER stands in for the signed-in user; the real
 * credential/SSO step wires in later.
 */

import type { BatchApproval, BatchStatus, UploadKind, UserRole } from '@/types/fsms';
import { REQUIRED_APPROVER_ROLES } from '@/types/fsms';

export interface Submission {
  id: string;
  kind: UploadKind;
  filename: string;
  file_url?: string | null;
  period_date: string;        // 'YYYY-MM-DD'
  plants: string[];
  uploader_id: string;
  uploader_name: string;
  status: BatchStatus;        // direct-import 'Approved' renders as "Imported"
  created_at: string;         // ISO
  status_at: string;          // ISO
  approvals: BatchApproval[]; // CONSO only
  summary?: { label: string; rows: number } | null; // direct-import parse summary
}

export interface CurrentUser {
  nameid: string;
  name: string;
  roles: UserRole[];
  isSuperAdmin: boolean;
}

/** Mock signed-in user. SuperAdmin so the demo can drive a batch through all approvals. */
export const MOCK_CURRENT_USER: CurrentUser = {
  nameid: '4033375',
  name: 'Faiz',
  roles: ['PIC-P1', 'Finance-PIC'],
  isSuperAdmin: true,
};

/** Friendly approver names per required role (display only). */
export const APPROVER_NAMES: Record<string, string> = {
  'PIC-P1': 'Tan W.K.',
  'PIC-P2': 'Lim C.S.',
  'PIC-BK': 'Rajesh M.',
  'Finance-PIC': 'Nurul A.',
};

export const UPLOAD_KINDS: { key: UploadKind; label: string; gated: boolean; hint: string }[] = [
  { key: 'CONSO',   label: 'CONSO',   gated: true,  hint: 'Floor-space consolidation — requires 4 approvals before it goes live.' },
  { key: 'REVENUE', label: 'Revenue', gated: false, hint: 'TM1 monthly revenue — direct import.' },
  { key: 'PRISM',   label: 'PRISM',   gated: false, hint: 'PRISM forward forecast — direct import.' },
  { key: 'RATE',    label: 'Rate',    gated: false, hint: '$/sqft rate settings — direct import.' },
];

export const requiredRolesFor = (kind: UploadKind): UserRole[] => (kind === 'CONSO' ? REQUIRED_APPROVER_ROLES : []);
export const isGated = (kind: UploadKind) => requiredRolesFor(kind).length > 0;

// ─── Badge styles ────────────────────────────────────────────────────────────────
export const STATUS_BADGE: Record<BatchStatus, string> = {
  Pending:    'bg-amber-500/15   text-amber-400   border-amber-500/30',
  Approved:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Rejected:   'bg-red-500/15     text-red-400     border-red-500/30',
  Superseded: 'bg-muted          text-muted-foreground border-border',
};

export const KIND_BADGE: Record<UploadKind, string> = {
  CONSO:   'bg-violet-500/15 text-violet-400 border-violet-500/30',
  REVENUE: 'bg-blue-500/15   text-blue-400   border-blue-500/30',
  PRISM:   'bg-sky-500/15    text-sky-400    border-sky-500/30',
  RATE:    'bg-amber-500/15  text-amber-400  border-amber-500/30',
};

/** "Imported" for a finished direct import, else the raw status. */
export const statusLabel = (s: Submission) => (!isGated(s.kind) && s.status === 'Approved' ? 'Imported' : s.status);

// ─── Seed submissions ────────────────────────────────────────────────────────────
const t = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
const appr = (batch_id: string, role: UserRole, decision: 'Approved' | 'Rejected', minsAgo: number, comment?: string): BatchApproval =>
  ({ batch_id, approver_id: APPROVER_NAMES[role] ?? role, role, decision, decided_at: t(minsAgo), comment: comment ?? null });

export const MOCK_SUBMISSIONS: Submission[] = [
  {
    id: '1042', kind: 'CONSO', filename: '26Q3 Mar CONSO South Asia.xlsx', period_date: '2026-03-01',
    plants: ['P1', 'P2', 'BK'], uploader_id: '4033375', uploader_name: 'Faiz',
    status: 'Pending', created_at: t(180), status_at: t(90),
    approvals: [appr('1042', 'PIC-P1', 'Approved', 120), appr('1042', 'PIC-P2', 'Approved', 90)],
  },
  {
    id: '1041', kind: 'CONSO', filename: '26Q3 Mar CONSO South Asia v2.xlsx', period_date: '2026-03-01',
    plants: ['BK'], uploader_id: '4033375', uploader_name: 'Faiz',
    status: 'Pending', created_at: t(45), status_at: t(45), approvals: [],
  },
  {
    id: '1040', kind: 'REVENUE', filename: 'TM1 Revenue Mar FY26.xlsx', period_date: '2026-03-01',
    plants: [], uploader_id: 'tm1.sync', uploader_name: 'TM1 Finance',
    status: 'Approved', created_at: t(200), status_at: t(200), approvals: [], summary: { label: 'revenue rows', rows: 312 },
  },
  {
    id: '1039', kind: 'PRISM', filename: 'PRISM Forecast Q3 FY26.xlsx', period_date: '2026-03-01',
    plants: ['P1', 'P2', 'BK'], uploader_id: 'cs.lim', uploader_name: 'Lim C.S.',
    status: 'Approved', created_at: t(240), status_at: t(240), approvals: [], summary: { label: 'forecast rows', rows: 540 },
  },
  {
    id: '1038', kind: 'CONSO', filename: '26Q2 Feb CONSO South Asia.xlsx', period_date: '2026-02-01',
    plants: ['P1', 'P2', 'BK'], uploader_id: '4033375', uploader_name: 'Faiz',
    status: 'Approved', created_at: t(10_080), status_at: t(9_900),
    approvals: [
      appr('1038', 'PIC-P1', 'Approved', 10_000), appr('1038', 'PIC-P2', 'Approved', 9_980),
      appr('1038', 'PIC-BK', 'Approved', 9_950), appr('1038', 'Finance-PIC', 'Approved', 9_900),
    ],
  },
  {
    id: '1037', kind: 'RATE', filename: 'Rate Settings Mar FY26.xlsx', period_date: '2026-03-01',
    plants: [], uploader_id: 'nurul.a', uploader_name: 'Nurul A.',
    status: 'Approved', created_at: t(300), status_at: t(300), approvals: [], summary: { label: 'rate rows', rows: 4 },
  },
  {
    id: '1035', kind: 'CONSO', filename: '26Q2 Jan CONSO South Asia.xlsx', period_date: '2026-01-01',
    plants: ['P1', 'P2'], uploader_id: 'cs.lim', uploader_name: 'Lim C.S.',
    status: 'Rejected', created_at: t(28_800), status_at: t(28_600),
    approvals: [
      appr('1035', 'PIC-P1', 'Approved', 28_750),
      appr('1035', 'Finance-PIC', 'Rejected', 28_600, 'Surplus mismatch vs PRISM — please re-check P2 SMT bays and re-stage.'),
    ],
  },
];

let nextId = 1043;
export const nextSubmissionId = () => String(nextId++);
