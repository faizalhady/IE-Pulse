/**
 * LBRGlobalConfig.tsx
 * ────────────────────
 * Platform-wide LBR rules. Read-only in v1.
 *
 * Route: /lbr/config
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LBR_TARGET, LBR_TAKT_TARGET } from '@/lib/lbr/lbrConstants';
import { ArrowLeft, Cog } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LBRGlobalConfig() {
  const navigate = useNavigate();
  return (
    <div className="relative">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 pt-2.5">
          <button onClick={() => navigate('/lbr')} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> LBR Home
          </button>
        </div>
        <div className="px-6 py-2.5">
          <h1 className="flex items-center gap-2 text-base font-bold text-foreground"><Cog className="h-4 w-4 text-emerald-500" /> Global Configuration</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">Platform-wide LBR rules and thresholds</p>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5 max-w-3xl">
        <Section title="Global LBR Targets">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ideal LBR (%)"><Input value={String(LBR_TARGET)} disabled className="bg-muted/40" /></Field>
            <Field label="Bottleneck TAKT target (%)"><Input value={String(LBR_TAKT_TARGET)} disabled className="bg-muted/40" /></Field>
          </div>
        </Section>

        <Section title="Status Thresholds">
          <div className="rounded-lg border border-border overflow-hidden">
            {[
              { s: 'Critical', d: 'LBR < 85%', c: 'text-red-400' },
              { s: 'Warning', d: '85% ≤ LBR < 90%', c: 'text-amber-400' },
              { s: 'Healthy', d: 'LBR ≥ 90%', c: 'text-emerald-400' },
              { s: 'Never Studied', d: 'No study recorded', c: 'text-muted-foreground' },
            ].map((r, i, arr) => (
              <div key={r.s} className={i < arr.length - 1 ? 'flex items-center justify-between px-3 py-2 border-b border-border' : 'flex items-center justify-between px-3 py-2'}>
                <span className={`text-[11px] font-semibold ${r.c}`}>{r.s}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{r.d}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Calculation Rules">
          <ul className="flex flex-col gap-2 text-[11px] text-muted-foreground">
            <Rule>Machine-only stations are excluded from operator count (n₀) and total operator CT (tcto).</Rule>
            <Rule>A machine counts toward the bottleneck only if it is the overall slowest station.</Rule>
            <Rule>Shared operators count as one station (combined cycle time).</Rule>
            <Rule>Parallel stations divide cycle time across the parallel units.</Rule>
          </ul>
        </Section>

        <p className="text-[10px] text-muted-foreground">Configuration is read-only in this prototype. Editing + persistence arrive with backend integration (Phase 2).</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">{title}</p>
        <Button size="sm" variant="outline" disabled>Edit</Button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">•</span><span>{children}</span></li>;
}
