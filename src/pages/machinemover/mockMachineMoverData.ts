/**
 * mockMachineMoverData.ts — types + seed data for the Machine Mover module.
 * Mock-backed prototype (no backend yet): a move "Job" is an order with a
 * status lifecycle (Created → Approved → Ongoing → Completed | Rejected) and
 * two PIC approvals. Mutations live in the shared store (useMoveJobs).
 */

import type { ApproverRole, JobStatus } from '@/lib/machine_mover/machineMoverConstants';

export interface JobApproval {
  role: ApproverRole;
  decision: 'Approved' | 'Rejected' | 'Pending';
  approver: string | null;
  decided_at: string | null;   // ISO
  comment: string | null;
}

export interface JobAttachment {
  name: string;
  size: number;  // bytes
}

export interface MoveJob {
  id: string;
  title: string;                // short summary, e.g. "Relocate SMT Reflow Oven"
  machines: string[];           // machine names / asset IDs
  department: string;
  pic: string;                  // requester (person in charge)
  fromLocation: string;         // point A
  toLocation: string;           // point B
  entranceDoor: string;         // door the machine enters through (at destination)
  exitDoor: string;             // door the machine exits through (at origin)
  date: string;                 // 'YYYY-MM-DD' — booked move date
  timeStart: string;            // 'HH:mm'
  timeEnd: string;              // 'HH:mm'
  logistics: string;            // Internal team / Lorry / Forklift / …
  reservation: string;          // free-text notes (e.g. "12 car parks reserve …")
  attachments: JobAttachment[];
  status: JobStatus;
  created_at: string;           // ISO
  status_at: string;            // ISO
  approvals: JobApproval[];     // two PIC sign-offs
}

export interface CurrentUser {
  id: string;
  name: string;
  isApprover: boolean;          // can accept/reject on the Approvals page
}

/** Mock signed-in user — an approver so the demo can drive a job end-to-end. */
export const MOCK_CURRENT_USER: CurrentUser = {
  id: '4033375',
  name: 'Faiz',
  isApprover: true,
};

// ─── Seed jobs ─────────────────────────────────────────────────────────────────
const t = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
const pending = (role: ApproverRole): JobApproval => ({ role, decision: 'Pending', approver: null, decided_at: null, comment: null });
const decided = (role: ApproverRole, decision: 'Approved' | 'Rejected', approver: string, minsAgo: number, comment?: string): JobApproval =>
  ({ role, decision, approver, decided_at: t(minsAgo), comment: comment ?? null });

export const MOCK_MOVE_JOBS: MoveJob[] = [
  {
    id: 'MM-1042', title: 'Relocate SMT Reflow Oven', machines: ['Reflow Oven #3 (RO-003)'],
    department: 'ME', pic: 'Kumaran', fromLocation: 'P1 — SMT Line 1', toLocation: 'P1 — SMT Line 2',
    entranceDoor: 'P1 Chamber Shutter', exitDoor: 'P1 Main Shutter',
    date: '2026-06-18', timeStart: '08:00', timeEnd: '17:00', logistics: 'Forklift',
    reservation: '12 car parks reserve outside Chamber room shutter door',
    attachments: [{ name: 'RO-003 dimensions.pdf', size: 184_320 }],
    status: 'Created', created_at: t(180), status_at: t(180),
    approvals: [decided('Department PIC', 'Approved', 'Tan W.K.', 120), pending('Facilities PIC')],
  },
  {
    id: 'MM-1041', title: 'Move AOI station to Test Area', machines: ['AOI Station (AOI-12)'],
    department: 'IE', pic: 'Faiz', fromLocation: 'P1 — SMT Line 2', toLocation: 'P1 — Test Area',
    entranceDoor: 'P1 Loading Bay', exitDoor: 'P1 Main Shutter',
    date: '2026-06-20', timeStart: '09:00', timeEnd: '13:00', logistics: 'Internal team',
    reservation: 'Aisle 4 kept clear 0900–1300',
    attachments: [],
    status: 'Created', created_at: t(60), status_at: t(60),
    approvals: [pending('Department PIC'), pending('Facilities PIC')],
  },
  {
    id: 'MM-1039', title: 'Transfer wave solder P1 → P2', machines: ['Wave Solder (WS-02)', 'Conveyor (CV-9)'],
    department: 'Production', pic: 'Lim C.S.', fromLocation: 'P1 — Test Area', toLocation: 'P2 — DF Line 1',
    entranceDoor: 'P2 Loading Bay', exitDoor: 'P1 Loading Bay',
    date: '2026-06-12', timeStart: '08:00', timeEnd: '18:00', logistics: 'Lorry (external)',
    reservation: 'Loading bay + 1 lorry slot 0800–1800; security pass for external driver',
    attachments: [{ name: 'WS-02 rigging plan.pdf', size: 421_900 }],
    status: 'Ongoing', created_at: t(4_320), status_at: t(30),
    approvals: [decided('Department PIC', 'Approved', 'Rajesh M.', 4_000), decided('Facilities PIC', 'Approved', 'Nurul A.', 3_900)],
  },
  {
    id: 'MM-1036', title: 'Relocate burn-in chamber', machines: ['Burn-in Chamber (BIC-1)'],
    department: 'Engineering', pic: 'Suresh', fromLocation: 'BK — Level 1', toLocation: 'BK — Level 2',
    entranceDoor: 'BK Dock 2', exitDoor: 'BK Dock 1',
    date: '2026-06-05', timeStart: '07:00', timeEnd: '19:00', logistics: 'Crane + Lorry',
    reservation: 'Dock 1 & 2 closed; crane permit filed',
    attachments: [{ name: 'BIC-1 lift permit.pdf', size: 98_300 }],
    status: 'Completed', created_at: t(20_160), status_at: t(11_520),
    approvals: [decided('Department PIC', 'Approved', 'Tan W.K.', 19_900), decided('Facilities PIC', 'Approved', 'Nurul A.', 19_800)],
  },
  {
    id: 'MM-1031', title: 'Move screen printer to warehouse', machines: ['Screen Printer (SP-7)'],
    department: 'Production', pic: 'Devi', fromLocation: 'P2 — DF Line 2', toLocation: 'P2 — Warehouse',
    entranceDoor: 'P2 Side Door', exitDoor: 'P2 Main Shutter',
    date: '2026-05-28', timeStart: '10:00', timeEnd: '15:00', logistics: 'Forklift',
    reservation: '—',
    attachments: [],
    status: 'Rejected', created_at: t(30_240), status_at: t(29_900),
    approvals: [
      decided('Department PIC', 'Approved', 'Rajesh M.', 30_000),
      decided('Facilities PIC', 'Rejected', 'Nurul A.', 29_900, 'Warehouse floor loading not rated for SP-7. Pick an alternate bay and re-submit.'),
    ],
  },
];

let nextId = 1043;
export const nextJobId = () => `MM-${nextId++}`;
