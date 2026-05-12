/**
 * oleTypes.ts
 * ───────────
 * Shared types used across OLE pages.
 */

export type WeekRow = {
  isoWeek: number;
  label: string;
  start: string;
  end: string;
};

export type WorkcellAggregate = {
  workcell: string;
  total_output_smh: number;
  total_input_hours: number;
  total_qty: number;
  total_shifts: number;
  flagged_shifts: number;
};

export type AggregateTotals = {
  ole_pct: number;
  total_output_smh: number;
  total_input_hours: number;
  total_qty: number;
  total_shifts: number;
  flagged_shifts: number;
};

export type WeeklyTrendPoint = {
  w: string;
  isoWeek: number;
  ole: number;
  smh: number;
  hrs: number;
};
