/**
 * IPKConfig.tsx
 * ──────────────
 * Workcell configuration: settings, process groups (reorderable — sequence
 * drives the IPK calculation), trolley types, and a danger zone.
 *
 * Route: /ipk/:workcell/config
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { IPK_CALC_TYPES, IPK_CALC_TYPE_LABEL, type IPKCalcType } from '@/lib/ipk/ipkConstants';
import { useIPKWorkcells } from '@/hooks/ipk/useIPKWorkcells';
import { useIPKProcessGroups } from '@/hooks/ipk/useIPKProcessGroups';
import {
  MOCK_TROLLEY_TYPES, type IPKProcessGroup, type IPKTrolleyType,
} from './mockIpkData';
import IPKWorkcellHeader from './IPKWorkcellHeader';
import { GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function IPKConfig() {
  const { workcell = '' } = useParams();
  const { data: workcells = [] } = useIPKWorkcells();
  const { data: serverGroups = [] } = useIPKProcessGroups(workcell);
  const wc = workcells.find(w => w.id === workcell);
  const wcName = wc?.name ?? workcell;

  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

  // Settings
  const [division, setDivision] = useState(wc?.division ?? '');
  const [days, setDays] = useState('20');
  const [hours, setHours] = useState('10.5');
  const [shifts, setShifts] = useState('2');
  const [buffer, setBuffer] = useState('15');
  const [periodType, setPeriodType] = useState(wc?.periodType === 'weekly' ? 'Weekly' : 'Monthly');
  useEffect(() => { if (wc) { setDivision(wc.division); setPeriodType(wc.periodType === 'weekly' ? 'Weekly' : 'Monthly'); } }, [wc]);

  // Process groups
  const [groups, setGroups] = useState<IPKProcessGroup[]>([]);
  useEffect(() => { setGroups(serverGroups); }, [serverGroups]);
  const dragIdx = useRef<number | null>(null);

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setGroups(gs => {
      const next = [...gs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    markDirty();
  };

  // Trolley types
  const [trolleys, setTrolleys] = useState<IPKTrolleyType[]>(MOCK_TROLLEY_TYPES);

  const nameOf = (id: string | null) => groups.find(g => g.id === id)?.name ?? '—';

  return (
    <div className="relative">
      <IPKWorkcellHeader
        workcellId={workcell}
        subtitle="Workcell configuration"
        actions={
          <Button size="sm" disabled={!dirty} onClick={() => setDirty(false)} className="bg-emerald-500 hover:bg-emerald-600">
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save
          </Button>
        }
      />

      <div className="p-5 flex flex-col gap-5 max-w-4xl">
        {/* ─── Section 1 — Settings ────────────────────────────────────── */}
        <Section title="Workcell Settings">
          <div className="grid grid-cols-3 gap-4 p-4">
            <Field label="Workcell name"><Input value={wcName} disabled className="bg-muted/40" /></Field>
            <Field label="Customer / Division"><Input value={division} onChange={e => { setDivision(e.target.value); markDirty(); }} /></Field>
            <Field label="Period type">
              <Select value={periodType} onValueChange={v => { setPeriodType(v); markDirty(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['Monthly', 'Weekly'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Days per period"><Input type="number" value={days} onChange={e => { setDays(e.target.value); markDirty(); }} /></Field>
            <Field label="Hours per shift"><Input type="number" step="0.5" value={hours} onChange={e => { setHours(e.target.value); markDirty(); }} /></Field>
            <Field label="Number of shifts">
              <Select value={shifts} onValueChange={v => { setShifts(v); markDirty(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['1', '2', '3'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Non-occupancy buffer (%)"><Input type="number" value={buffer} onChange={e => { setBuffer(e.target.value); markDirty(); }} /></Field>
          </div>
        </Section>

        {/* ─── Section 2 — Process Groups ──────────────────────────────── */}
        <Section title="Process Groups" hint="Drag to reorder — sequence drives the IPK calculation">
          <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: '2rem 1.5rem minmax(8rem,1fr) 9rem 8rem minmax(8rem,1.5fr) 2rem' }}>
            {['', '#', 'Group Name', 'Calc Type', 'Upstream', 'Processes', ''].map((h, i) => <div key={i} className="px-2 py-2">{h}</div>)}
          </div>
          {groups.map((g, idx) => (
            <div key={g.id}
              draggable
              onDragStart={() => { dragIdx.current = idx; }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragIdx.current !== null) reorder(dragIdx.current, idx); dragIdx.current = null; }}
              className="grid items-center border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              style={{ gridTemplateColumns: '2rem 1.5rem minmax(8rem,1fr) 9rem 8rem minmax(8rem,1.5fr) 2rem' }}>
              <div className="px-2 flex justify-center cursor-grab text-muted-foreground/50 hover:text-muted-foreground">
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{idx + 1}</div>
              <div className="p-1.5">
                <Input className="h-8 text-xs" value={g.name}
                  onChange={e => { setGroups(gs => gs.map(x => x.id === g.id ? { ...x, name: e.target.value } : x)); markDirty(); }} />
              </div>
              <div className="p-1.5">
                <Select value={g.calcType}
                  onValueChange={v => { setGroups(gs => gs.map(x => x.id === g.id ? { ...x, calcType: v as IPKCalcType } : x)); markDirty(); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{IPK_CALC_TYPES.map(t => <SelectItem key={t} value={t}>{IPK_CALC_TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="px-2 text-[10px] text-muted-foreground truncate">{nameOf(g.upstreamGroup)}</div>
              <div className="px-2 text-[10px] text-muted-foreground truncate">{g.processes.join(', ')}</div>
              <div className="px-2 flex justify-center">
                <button onClick={() => { setGroups(gs => gs.filter(x => x.id !== g.id)); markDirty(); }}
                  className="text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
          <button
            onClick={() => { setGroups(gs => [...gs, { id: `pg-new-${gs.length}`, name: '', calcType: 'normal', upstreamGroup: gs[gs.length - 1]?.id ?? null, processes: [] }]); markDirty(); }}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-emerald-400 hover:bg-muted/30 transition-colors border-t border-border"
          >
            <Plus className="h-3.5 w-3.5" /> Add Process Group
          </button>
        </Section>

        {/* ─── Section 3 — Trolley Types ───────────────────────────────── */}
        <Section title="Trolley Types">
          <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
            style={{ gridTemplateColumns: 'minmax(8rem,1.5fr) 9rem 6rem 8rem 8rem 2rem' }}>
            {['Assembly PN', 'Trolley Type', 'Cavities', 'Boards/Cavity', 'Boards/Trolley', ''].map((h, i) => <div key={i} className="px-2 py-2">{h}</div>)}
          </div>
          {trolleys.map(t => {
            const perTrolley = t.cavities * t.boardsPerCavity;
            return (
              <div key={t.id} className="grid items-center border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                style={{ gridTemplateColumns: 'minmax(8rem,1.5fr) 9rem 6rem 8rem 8rem 2rem' }}>
                <div className="p-1.5"><Input className="h-8 text-xs font-mono" value={t.assemblyPN}
                  onChange={e => { setTrolleys(ts => ts.map(x => x.id === t.id ? { ...x, assemblyPN: e.target.value } : x)); markDirty(); }} /></div>
                <div className="p-1.5"><Input className="h-8 text-xs" value={t.trolleyType}
                  onChange={e => { setTrolleys(ts => ts.map(x => x.id === t.id ? { ...x, trolleyType: e.target.value } : x)); markDirty(); }} /></div>
                <div className="p-1.5"><Input className="h-8 text-xs font-mono" type="number" value={t.cavities}
                  onChange={e => { setTrolleys(ts => ts.map(x => x.id === t.id ? { ...x, cavities: Number(e.target.value) || 0 } : x)); markDirty(); }} /></div>
                <div className="p-1.5"><Input className="h-8 text-xs font-mono" type="number" value={t.boardsPerCavity}
                  onChange={e => { setTrolleys(ts => ts.map(x => x.id === t.id ? { ...x, boardsPerCavity: Number(e.target.value) || 0 } : x)); markDirty(); }} /></div>
                <div className="px-2 text-[11px] font-mono text-muted-foreground tabular-nums">{perTrolley}</div>
                <div className="px-2 flex justify-center">
                  <button onClick={() => { setTrolleys(ts => ts.filter(x => x.id !== t.id)); markDirty(); }}
                    className="text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
          <button
            onClick={() => { setTrolleys(ts => [...ts, { id: `tt-new-${ts.length}`, assemblyPN: '', trolleyType: '', cavities: 1, boardsPerCavity: 1 }]); markDirty(); }}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold text-emerald-400 hover:bg-muted/30 transition-colors border-t border-border"
          >
            <Plus className="h-3.5 w-3.5" /> Add Trolley Type
          </button>
        </Section>

        {/* ─── Section 4 — Danger Zone ─────────────────────────────────── */}
        <div className="rounded-xl border border-red-500/30 bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-red-500/30">
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Danger Zone</p>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <DangerRow title="Clear all run history" desc="Permanently delete every past simulation for this workcell." />
            <DangerRow title="Reset config to defaults" desc="Restore process groups, trolley types, and settings to defaults." />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">{title}</p>
        {hint && <span className="text-[9px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
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

function DangerRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <Button size="sm" variant="outline" disabled
        className="border-red-500/30 text-red-400/60 flex-shrink-0">
        Disabled
      </Button>
    </div>
  );
}
