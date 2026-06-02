/**
 * LBRWorkcellConfig.tsx
 * ──────────────────────
 * Workcell-specific LBR config. Read-only in v1 (Edit buttons disabled).
 *
 * Route: /lbr/:workcell/config
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLBRWorkcells } from '@/hooks/lbr/useLBRWorkcells';
import { useLBRAssemblies } from '@/hooks/lbr/useLBRAssemblies';
import LBRBreadcrumb from './LBRBreadcrumb';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

export default function LBRWorkcellConfig() {
  const { workcell: paramWc = '' } = useParams();
  const workcellId = decodeURIComponent(paramWc);
  const { data: workcells = [] } = useLBRWorkcells();
  const { data: assemblies = [] } = useLBRAssemblies(workcellId);
  const wc = workcells.find(w => w.id === workcellId);
  const wcName = wc?.name ?? workcellId;

  // Lines present in this workcell (derived from assemblies).
  const lines = useMemo(() => Array.from(new Set(assemblies.map(a => a.line))), [assemblies]);

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-3">
          <LBRBreadcrumb items={[
            { label: 'LBR', href: '/lbr' },
            { label: wcName, href: `/lbr/${encodeURIComponent(workcellId)}`, workcellLogoKey: wcName },
            { label: 'Config' },
          ]} />
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5 max-w-3xl">
        {/* Line settings */}
        <Section title="Line Settings" actionDisabled>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold" style={{ gridTemplateColumns: '1fr 8rem 8rem 8rem' }}>
              {['Line', 'TAKT (s)', 'Available (s)', 'Shift hrs'].map((h, i) => <div key={i} className="px-3 py-2">{h}</div>)}
            </div>
            {lines.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-muted-foreground">No lines configured.</div>
            ) : lines.map(l => (
              <div key={l} className="grid items-center border-t border-border" style={{ gridTemplateColumns: '1fr 8rem 8rem 8rem' }}>
                <div className="px-3 py-2 text-[11px] font-semibold text-foreground">{l}</div>
                <div className="px-3 py-2 text-[11px] font-mono text-muted-foreground">60</div>
                <div className="px-3 py-2 text-[11px] font-mono text-muted-foreground">37,800</div>
                <div className="px-3 py-2 text-[11px] font-mono text-muted-foreground">10.5</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Operator pool */}
        <Section title="Operator Pool" actionDisabled>
          <div className="flex flex-wrap gap-2">
            {['OP1', 'OP2', 'OP3', 'OP4', 'OP5', 'OP6'].map(op => (
              <span key={op} className="text-[11px] font-mono px-2 py-1 rounded border border-border bg-muted/30 text-muted-foreground">{op}</span>
            ))}
          </div>
        </Section>

        {/* Custom thresholds */}
        <Section title="Custom Status Thresholds" hint="Override the global LBR thresholds for this workcell" actionDisabled>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Critical below (%)"><Input value="85" disabled className="bg-muted/40" /></Field>
            <Field label="Warning below (%)"><Input value="90" disabled className="bg-muted/40" /></Field>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, hint, actionDisabled, children }: { title: string; hint?: string; actionDisabled?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">{title}</p>
          {hint && <p className="text-[9px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        {actionDisabled && <Button size="sm" variant="outline" disabled>Edit</Button>}
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
