/**
 * useMoveJobs.ts — tiny shared store for Machine Mover jobs.
 * ──────────────────────────────────────────────────────────────────────────────
 * Mock prototype: jobs live in a module-level array so edits on the Home page
 * (create) and the Approvals page (accept/reject/advance) stay in sync as the
 * user navigates between routes. Reactive via useSyncExternalStore. Swap the
 * store internals for react-query mutations when the backend lands.
 */

import {
  MOCK_MOVE_JOBS, nextJobId, type JobApproval, type MoveJob,
} from '@/pages/machinemover/mockMachineMoverData';
import type { ApproverRole, JobStatus } from '@/lib/machine_mover/machineMoverConstants';
import { APPROVER_ROLES } from '@/lib/machine_mover/machineMoverConstants';
import { useSyncExternalStore } from 'react';

let jobs: MoveJob[] = [...MOCK_MOVE_JOBS];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => jobs;

/** Subscribe a component to the live job list. */
export function useMoveJobs(): MoveJob[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Input for a brand-new request (everything the form collects). */
export type NewJobInput = Omit<MoveJob, 'id' | 'status' | 'created_at' | 'status_at' | 'approvals'>;

/** Create a job in the Created state with both PIC approvals pending. */
export function createJob(input: NewJobInput): MoveJob {
  const now = new Date().toISOString();
  const job: MoveJob = {
    ...input,
    id: nextJobId(),
    status: 'Created',
    created_at: now,
    status_at: now,
    approvals: APPROVER_ROLES.map((role) => ({ role, decision: 'Pending', approver: null, decided_at: null, comment: null } as JobApproval)),
  };
  jobs = [job, ...jobs];
  emit();
  return job;
}

/** Record one PIC's decision. A rejection rejects the job immediately; once
 *  BOTH required roles have approved the job advances to Approved. */
export function decideJob(id: string, role: ApproverRole, decision: 'Approved' | 'Rejected', approver: string, comment: string): void {
  const now = new Date().toISOString();
  jobs = jobs.map((j) => {
    if (j.id !== id) return j;
    const approvals = j.approvals.map((a) =>
      a.role === role ? { ...a, decision, approver, decided_at: now, comment: comment || null } : a,
    );
    let status: JobStatus = j.status;
    if (decision === 'Rejected') status = 'Rejected';
    else if (approvals.every((a) => a.decision === 'Approved')) status = 'Approved';
    return { ...j, approvals, status, status_at: now };
  });
  emit();
}

/** Move a job to the next lifecycle state (Approved → Ongoing → Completed). */
export function setJobStatus(id: string, status: JobStatus): void {
  const now = new Date().toISOString();
  jobs = jobs.map((j) => (j.id === id ? { ...j, status, status_at: now } : j));
  emit();
}
