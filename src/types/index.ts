export type StatusLevel = 'optimal' | 'warning' | 'critical' | 'idle';

export interface Machine {
  id: string;
  name: string;
  bayId: string;
  uph: number;
  status: StatusLevel;
  wipCount: number;
  sparklineData: number[];
}

export interface HourlyRecord {
  hour: string;
  plan: number;
  actual: number;
}

export interface DowntimeEntry {
  timestamp: string;
  duration: string;
  reason: string;
}

export interface Bay {
  id: string;
  name: string;
  workcellId: string;
  model: string;
  productivity: number;
  plan: number;
  cumm: number;
  delta: number;
  status: StatusLevel;
  hourlyData: HourlyRecord[];
  machines: Machine[];
  overallWip: number;
  pendingWip: number;
  downtimeLog: DowntimeEntry[];
  operatorOnDuty: string;
}

export interface Workcell {
  id: string;
  name: string;
  bayIds: string[];
  status: StatusLevel;
}

export type UserRole = 'operator' | 'supervisor' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export function getStatusLevel(productivity: number | null): StatusLevel {
  if (productivity === null || productivity === 0) return 'idle';
  if (productivity > 85) return 'optimal';
  if (productivity >= 50) return 'warning';
  return 'critical';
}
