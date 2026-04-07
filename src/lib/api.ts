/**
 * api.ts — typed client for the MES data hub
 *
 * All calls go to /api/* which Vite proxies → http://localhost:3000 in dev.
 * In production, Nginx handles the proxy (add location /api/ block).
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const workcells = await api.workcells.list();
 */

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Response shapes (mirrors MES API) ────────────────────────────────────────

export interface ApiWorkcell {
  customer_id: number;
  workcell_name: string;
  division_name: string;
  display_name: string;
  active: number;
}

export interface ApiWorkcellBay {
  customer_id: number;
  workcell_name: string;
  plant: string;
  bay: string;
  step_count: number;
}

export interface ApiProductionSummary {
  customer_id: number;
  workcell_name: string;
  bay: string;
  total_batches: number;
  total_assemblies: number;
  total_steps: number;
  total_output: number;
  latest_activity: string;
}

export interface ApiProductionByBay {
  customer_id: number;
  workcell_name: string;
  bay: string;
  total_batches: number;
  total_assemblies: number;
  total_output: number;
  latest_activity: string;
}

export interface ApiProductionLatest {
  customer_id: number;
  workcell_name: string;
  bay: string;
  assembly: string;
  route_step: string;
  actual_qty: number;
  last_scan_dts: string;
}

export interface ApiProductionByAssembly {
  customer_id: number;
  workcell_name: string;
  bay: string;
  assembly: string;
  batch_id: string;
  total_output: number;
  started: string;
  last_activity: string;
}

export interface ApiPlant {
  plant: string;
  step_count: number;
}

export interface ApiAssembly {
  assembly_id:      number;
  customer_id:      number;
  workcell_name:    string;
  product_number:   string;
  product_name:     string;
  revision:         string;
  family_name:      string;
  active:           number;
  last_updated_mes: string;
}

export interface ApiWorkcellSummary {
  workcell: ApiWorkcell;
  plants: string[];
  stats: {
    total_bays: number;
    total_routes: number;
    total_steps: number;
  };
}

// ─── API client ───────────────────────────────────────────────────────────────

export const api = {
  workcells: {
    /** All active workcells */
    list: () =>
      get<ApiWorkcell[]>('/workcells'),

    /** Bays for a workcell, optionally filtered by plant */
    bays: (workcell_id: number, plant?: string) =>
      get<ApiWorkcellBay[]>(
        `/workcells/bays?workcell_id=${workcell_id}${plant ? `&plant=${plant}` : ''}`
      ),

    /** Workcells active in a given plant */
    byPlant: (plant: string) =>
      get<{ customer_id: number; workcell_name: string; bay_count: number }[]>(
        `/workcells/by-plant?plant=${encodeURIComponent(plant)}`
      ),

    /** Full summary: stats + plants list */
    summary: (workcell_id: number, plant?: string) =>
      get<ApiWorkcellSummary>(
        `/workcells/summary?workcell_id=${workcell_id}${plant ? `&plant=${plant}` : ''}`
      ),
  },

  production: {
    /** Output grouped by bay — used for bay cards */
    byBay: (workcell_id?: number, plant?: string) => {
      const params = new URLSearchParams();
      if (workcell_id) params.set('workcell_id', String(workcell_id));
      if (plant) params.set('plant', plant);
      return get<ApiProductionByBay[]>(`/production/by-bay?${params}`);
    },

    /** Aggregated summary per bay */
    summary: (workcell_id?: number, plant?: string) => {
      const params = new URLSearchParams();
      if (workcell_id) params.set('workcell_id', String(workcell_id));
      if (plant) params.set('plant', plant);
      return get<ApiProductionSummary[]>(`/production/summary?${params}`);
    },

    /** Most recent scan activity — live feed */
    latest: (workcell_id?: number, plant?: string, limit = 20) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (workcell_id) params.set('workcell_id', String(workcell_id));
      if (plant) params.set('plant', plant);
      return get<ApiProductionLatest[]>(`/production/latest?${params}`);
    },

    /** Output grouped by assembly (product model) */
    byAssembly: (workcell_id?: number, bay?: string) => {
      const params = new URLSearchParams();
      if (workcell_id) params.set('workcell_id', String(workcell_id));
      if (bay) params.set('bay', bay);
      return get<ApiProductionByAssembly[]>(`/production/by-assembly?${params}`);
    },
  },

assemblies: {
  /** * Fetches assemblies for a workcell. 
   * Passing limit='all' triggers the 999999 limit in your Elysia backend.
   */
  list: (workcell_id: number, limit: string | number = 'all', offset = 0) =>
    get<ApiAssembly[]>(`/assemblies?workcell_id=${workcell_id}&limit=${limit}&offset=${offset}`),
},

  locations: {
    /** All plants with step counts */
    plants: () =>
      get<ApiPlant[]>('/locations/plants'),

    /** Bays in a plant */
    bays: (plant?: string) => {
      const params = plant ? `?plant=${encodeURIComponent(plant)}` : '';
      return get<{ plant: string; bay: string; step_count: number }[]>(
        `/locations/bays${params}`
      );
    },
  },
};
