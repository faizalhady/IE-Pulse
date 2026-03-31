export type StatusLevel = 'optimal' | 'warning' | 'critical' | 'idle';

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

// Maps to our API: /workcells/steps response
export interface RouteStep {
  route_step_id: number;
  step_name: string;
  step_description: string;
  step_order: number;
  step_type: string;
  is_birthing_station: number;
}

// Maps to our API: /production/by-assembly response
export interface AssemblyProduction {
  assembly: string;
  batch_id: string;
  total_output: number;
  started: string;
  last_activity: string;
}

// Maps to our API: /workcells/bays response
export interface Bay {
  // from our API
  customer_id: number;
  workcell_name: string;
  plant: string;
  bay: string;                  // replaces mock: name
  step_count: number;

  // derived/calculated fields for display
  productivity: number;
  status: StatusLevel;
  plan: number;
  cumm: number;
  delta: number;

  // production data
  total_output: number;
  latest_activity: string;
  assemblies_running: AssemblyProduction[];

  // operational
  hourlyData: HourlyRecord[];
  downtimeLog: DowntimeEntry[];
  operatorOnDuty: string;
}

// Maps to our API: /workcells response
export interface Workcell {
  customer_id: number;          // replaces mock: id (string)
  workcell_name: string;        // replaces mock: name
  division_name: string;
  display_name: string;
  active: number;
  status: StatusLevel;
  bay_count?: number;
  total_output?: number;
  latest_activity?: string;
}

// Maps to our API: /locations/plants
export interface Plant {
  plant: string;                // "P1", "P2", "BK"
  step_count: number;
  workcell_count?: number;
}

export type UserRole = 'operator' | 'supervisor' | 'engineer' | 'admin';

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