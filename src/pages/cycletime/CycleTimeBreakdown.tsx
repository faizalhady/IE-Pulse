/**
 * CycleTimeBreakdown.tsx
 * ──────────────────────
 * Workcell breakdown — the "Breakdown" tab on the Cycle Time page.
 *
 * Shows three honest cycle-time roll-ups for the selected customer:
 *   1. Counts      — assemblies / lines / processes / freshness
 *   2. By line     — each line's build count, typical build time, operators
 *   3. Longest builds — the heaviest assemblies, click to open in the table
 *
 * Everything here derives from the same cycle-time column the table shows,
 * just summed at the line / assembly level. No averaging across unlike
 * assemblies, no bottleneck framing (parked for a later step).
 */

import { AlertCircle, Clock, Loader2 } from 'lucide-react';

import {
  CycleTimeProfileAssembly,
  CycleTimeProfileLine,
  formatBuildDuration,
} from '@/lib/cycle_time/cycleTimeApi';
import { useCycleTimeProfile } from '@/hooks/cycle_time/useCycleTimeData';

interface CycleTimeBreakdownProps {
  customer: string | undefined;
  /** Jump to the table, filtered to one assembly + line. */
  onOpenAssembly: (assembly: string, line: string) => void;
}

export default function CycleTimeBreakdown({ customer, onOpenAssembly }: CycleTimeBreakdownProps) {
  const { data, isFetching, error } = useCycleTimeProfile(customer);

  // ── Empty / loading / error states ──────────────────────────────────────────
  if (!customer) {
    return (
      <Centered>
        <Clock className="mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Select a customer to see its breakdown.</p>
      </Centered>
    );
  }
  if (isFetching && !data) {
    return (
      <Centered>
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">Loading breakdown…</p>
      </Centered>
    );
  }
  if (error) {
    return (
      <Centered>
        <AlertCircle className="mb-3 h-8 w-8 text-red-500/70" />
        <p className="text-sm text-muted-foreground">
          Couldn’t load breakdown: {(error as Error).message}
        </p>
      </Centered>
    );
  }
  if (!data) return null;

  const { summary, lines, top_assemblies } = data;
  const updated = summary.updated_on
    ? new Date(summary.updated_on).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : '—';

  return (
    <div className="h-full overflow-auto px-6 py-5">
      {/* ── 1. Counts ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Assemblies" value={summary.assemblies.toLocaleString()} />
        <Stat label="Lines"      value={summary.lines.toLocaleString()} />
        <Stat label="Processes"  value={summary.processes.toLocaleString()} />
        <Stat label="Last updated" value={updated} />
      </div>

      {/* ── 2. By line ─────────────────────────────────────────────────── */}
      <Section title="By line" hint={`${summary.builds.toLocaleString()} builds total`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <Th>Line</Th>
              <Th className="text-right">Builds</Th>
              <Th className="text-right">Assemblies</Th>
              <Th className="text-right">Avg build</Th>
              <Th className="text-right">Operators / build</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l: CycleTimeProfileLine) => (
              <tr key={l.sub_workcenter} className="border-b border-border/60 hover:bg-muted/30">
                <Td className="font-medium">{l.sub_workcenter}</Td>
                <Td className="text-right tabular-nums">{l.builds.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{l.assemblies.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{formatBuildDuration(l.avg_build_seconds)}</Td>
                <Td className="text-right tabular-nums">
                  {l.avg_build_hc == null ? '—' : l.avg_build_hc.toFixed(1)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ── 3. Longest builds ──────────────────────────────────────────── */}
      <Section title="Longest builds" hint="Click a row to open it in the table">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <Th>Assembly</Th>
              <Th>Rev</Th>
              <Th>Line</Th>
              <Th className="text-right">Build time</Th>
              <Th className="text-right">Steps</Th>
            </tr>
          </thead>
          <tbody>
            {top_assemblies.map((a: CycleTimeProfileAssembly, i) => (
              <tr
                key={`${a.assembly}|${a.revision}|${a.sub_workcenter}|${i}`}
                onClick={() => onOpenAssembly(a.assembly, a.sub_workcenter)}
                className="cursor-pointer border-b border-border/60 hover:bg-muted/30"
                title="Open in the table"
              >
                <Td className="font-medium">{a.assembly}</Td>
                <Td className="text-muted-foreground">{a.revision}</Td>
                <Td className="text-muted-foreground">{a.sub_workcenter}</Td>
                <Td className="text-right tabular-nums">{formatBuildDuration(a.total_seconds)}</Td>
                <Td className="text-right tabular-nums">{a.n_processes}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ─── Small presentational helpers ─────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="overflow-hidden rounded-lg border border-border">{children}</div>
    </section>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 font-medium ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">{children}</div>
  );
}
