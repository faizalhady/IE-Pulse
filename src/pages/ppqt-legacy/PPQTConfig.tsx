/**
 * PPQTConfig.tsx
 * ───────────────
 * PPQT Configuration page — Phase 2 (data entry layer).
 *
 * Stub for now. When built, this page replaces manual Excel entry with
 * structured forms for IEDB, DMAN, SBWC, and DASH inputs:
 *   • IEDB editor    — process steps, cycle times, capacity, CT source
 *   • Demand entry   — assemblies and their monthly demand
 *   • Equipment cfg  — machines and headcount per sub-workcenter
 *   • Shift config   — shift hours, working days, changeovers, FPY, efficiency
 *   • CT study queue — track and prioritize stopwatch / MOST studies
 */

import {
  AlertTriangle,
  Database,
  Factory,
  FlaskConical,
  Layers,
  ListChecks,
  Settings2,
  Sigma,
} from 'lucide-react';

const SECTIONS = [
  {
    icon: Database,
    title: 'IEDB editor',
    description: 'Create, edit, and delete process steps. Set Mach / IMT / Hand cycle times, capacity, FPY, and CT source.',
  },
  {
    icon: Sigma,
    title: 'Demand entry',
    description: 'Enter monthly demand per assembly. Source from MPS / SCR / CTB. Bulk paste from spreadsheet.',
  },
  {
    icon: Factory,
    title: 'Equipment config (SBWC)',
    description: 'Confirm machine count and headcount per sub-workcenter + process. The "what we have today" figure.',
  },
  {
    icon: Settings2,
    title: 'Shift parameters (DASH)',
    description: 'Set shift hours, working days, changeover qty / time, FPY, and efficiency per process column.',
  },
  {
    icon: FlaskConical,
    title: 'CT study queue',
    description: 'Track which estimated CTs need a formal MOST or stopwatch study. Prioritized by impact on bottlenecks.',
  },
  {
    icon: ListChecks,
    title: 'Audit log',
    description: 'Who changed what, when, and why. Required for quotation traceability.',
  },
] as const;

export default function PPQTConfig() {
  return (
    <div className="space-y-0">

      {/* ─── Sticky header ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-4 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Settings2 className="h-5 w-5 text-emerald-500" />
              PPQT Configuration
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Data entry layer — manage the source data behind every PPQT calculation
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
            <AlertTriangle className="h-3 w-3" />
            Phase 2 — not yet built
          </span>
        </div>
      </div>

      {/* ─── Content ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-6">
        <div className="max-w-3xl mx-auto">

          {/* Hero callout */}
          <div className="rounded-xl border border-border bg-card p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-foreground">Replace the Excel workflow</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Today, IEs enter PPQT data manually across the IEDB, DMAN, SBWC, and DASH tabs of an Excel workbook.
                  Phase 2 brings that entry into IE-Pulse with structured forms, validation, and a full audit trail —
                  so the Dashboard view becomes live, not a snapshot.
                </p>
              </div>
            </div>
          </div>

          {/* Planned sections */}
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Planned sections
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SECTIONS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-4 hover:border-border/80 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {s.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
