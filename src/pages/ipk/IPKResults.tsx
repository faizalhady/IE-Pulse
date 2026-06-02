/**
 * IPKResults.tsx
 * ───────────────
 * Full results view after any simulation mode completes.
 * Summary table with inline-editable trolley counts, auto-computed totals,
 * expandable per-group calculation breakdowns, and XLSX export.
 *
 * Route: /ipk/:workcell/results/:runId
 */

import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { totalRequired } from '@/lib/ipk/ipkCalc';
import { exportIPKResults } from '@/lib/ipk/ipkExport';
import { IPK_VARIANCE_CLASS, IPK_VARIANCE_TEXT, type IPKSource } from '@/lib/ipk/ipkConstants';
import { useIPKWorkcells } from '@/hooks/ipk/useIPKWorkcells';
import { useIPKSummary } from '@/hooks/ipk/useIPKSummary';
import type { IPKSummaryRow } from './mockIpkData';
import IPKWorkcellHeader from './IPKWorkcellHeader';
import {
  ChevronDown, ChevronRight, Download, FileSpreadsheet, Loader2, Play,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const GRID = '2rem 1.5rem minmax(8rem,1fr) 5rem 4.5rem 4.5rem 5rem 4.5rem 4rem 4rem 4rem 5.5rem 5rem 4.5rem';
const HEADERS = ['', '#', 'Process Group', 'Loading', 'Eff.UPH', 'IPK U', 'WIP+Buf', 'IPK Trly', 'In/Out', 'Reject', 'On-Hold', 'Required', 'On Floor', 'Var'];

/** Map a runId slug to a display source. */
function sourceOf(runId: string): IPKSource {
  if (runId.includes('wizard')) return 'Wizard';
  if (runId.includes('manual')) return 'Manual';
  return 'Excel';
}

export default function IPKResults() {
  const navigate = useNavigate();
  const { workcell = '', runId = 'latest' } = useParams();
  const { data: workcells = [] } = useIPKWorkcells();
  const { data: serverRows = [] } = useIPKSummary(workcell);

  const wc = workcells.find(w => w.id === workcell);
  const wcName = wc?.name ?? workcell;
  const source = sourceOf(runId);

  // Local editable copy of the summary rows.
  const [rows, setRows] = useState<IPKSummaryRow[]>([]);
  useEffect(() => { setRows(serverRows); }, [serverRows]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const editRow = (idx: number, patch: Partial<IPKSummaryRow>) =>
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const totals = useMemo(() => {
    const t = { ipkUnits: 0, required: 0, onFloor: 0, variance: 0 };
    rows.forEach(r => {
      const req = totalRequired(r);
      t.ipkUnits += r.ipkUnits;
      t.required += req;
      t.onFloor += r.actualOnFloor;
      t.variance += req - r.actualOnFloor;
    });
    return t;
  }, [rows]);

  async function handleExport() {
    if (!rows.length || exporting) return;
    setExporting(true);
    try {
      await exportIPKResults({ rows, workcell: wcName, period: wc?.period ?? '—', source });
    } catch (e) {
      console.error('IPK export failed', e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative">
      <IPKWorkcellHeader
        workcellId={workcell}
        subtitle={`Results · ${wc?.period ?? '—'} · ${wc?.lastRun ?? '—'} · source: ${source}`}
        actions={<>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={!rows.length || exporting}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport} disabled={!rows.length || exporting}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Download as XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => navigate(`/ipk/${encodeURIComponent(workcell)}/simulate`)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors"
          >
            <Play className="h-3.5 w-3.5" /> Run New Simulation
          </button>
        </>}
      />

      <div className="p-5 flex flex-col gap-5">
        {/* ─── Stat cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total IPK Units" value={totals.ipkUnits} />
          <StatCard label="Total Trolleys Required" value={totals.required} />
          <StatCard label="Trolleys on Floor" value={totals.onFloor} muted />
          <StatCard label="Variance" value={totals.variance} valueClass={IPK_VARIANCE_TEXT(totals.variance)} signed />
        </div>

        {/* ─── Summary table ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Process Group Results</p>
            <span className="text-[9px] text-muted-foreground">In/Out · Reject · On-Hold · On Floor are editable · expand a row for the calculation</span>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: 980 }}>
              {/* header */}
              <div className="grid bg-muted/50 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold border-b border-border"
                style={{ gridTemplateColumns: GRID }}>
                {HEADERS.map((h, i) => <div key={i} className={cn('px-2 py-2', i >= 3 && 'text-right')}>{h}</div>)}
              </div>

              {rows.map((r, idx) => {
                const req = totalRequired(r);
                const variance = req - r.actualOnFloor;
                const isOpen = expanded.has(r.processGroup);
                return (
                  <div key={r.processGroup} className="border-b border-border last:border-0">
                    <div className="grid items-center hover:bg-muted/20 transition-colors" style={{ gridTemplateColumns: GRID, minHeight: 44 }}>
                      <div className="px-2 flex justify-center">
                        <button onClick={() => toggle(r.processGroup)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <div className="px-2 text-[10px] text-muted-foreground font-mono tabular-nums">{idx + 1}</div>
                      <div className="px-2 text-[11px] font-semibold text-foreground truncate">{r.processGroup}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{r.loadingQty.toLocaleString()}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{r.effectiveUph}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{r.ipkUnits}</div>
                      <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{r.wipWithBuffer}</div>
                      <div className="px-2 text-right text-[11px] font-mono font-semibold text-foreground tabular-nums">{r.ipkTrolleys}</div>
                      <EditCell value={r.inOutTrolleys}  onChange={v => editRow(idx, { inOutTrolleys: v })} />
                      <EditCell value={r.rejectTrolleys} onChange={v => editRow(idx, { rejectTrolleys: v })} />
                      <EditCell value={r.onHoldTrolleys} onChange={v => editRow(idx, { onHoldTrolleys: v })} />
                      <div className="px-2 text-right text-[11px] font-mono font-bold text-foreground tabular-nums">{req}</div>
                      <EditCell value={r.actualOnFloor}  onChange={v => editRow(idx, { actualOnFloor: v })} />
                      <div className={cn('px-1 mx-1 my-1.5 rounded text-center text-[11px] font-mono font-bold tabular-nums flex items-center justify-center', IPK_VARIANCE_CLASS(variance))}>
                        {variance > 0 ? `+${variance}` : variance}
                      </div>
                    </div>

                    {isOpen && <Breakdown row={r} />}
                  </div>
                );
              })}

              {/* totals row */}
              <div className="grid items-center bg-muted/30 border-t-2 border-border font-bold" style={{ gridTemplateColumns: GRID, minHeight: 40 }}>
                <div /><div />
                <div className="px-2 text-[11px] text-foreground uppercase tracking-wider">Total</div>
                <div /><div />
                <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{totals.ipkUnits}</div>
                <div /><div /><div /><div /><div />
                <div className="px-2 text-right text-[11px] font-mono text-foreground tabular-nums">{totals.required}</div>
                <div className="px-2 text-right text-[11px] font-mono text-muted-foreground tabular-nums">{totals.onFloor}</div>
                <div className={cn('px-1 mx-1 my-1 rounded text-center text-[11px] font-mono tabular-nums flex items-center justify-center', IPK_VARIANCE_CLASS(totals.variance))}>
                  {totals.variance > 0 ? `+${totals.variance}` : totals.variance}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Expanded calculation breakdown ─────────────────────────────────────────────
function Breakdown({ row: r }: { row: IPKSummaryRow }) {
  const rawUph = r.bottleneckCtSec > 0 ? (3600 / r.bottleneckCtSec).toFixed(1) : '0';
  const bufferMult = r.wipWithBuffer && r.ipkUnits ? (r.wipWithBuffer / r.ipkUnits).toFixed(2) : '1.15';
  return (
    <div className="bg-muted/10 border-t border-border px-6 py-4">
      <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3">
        Calculation Breakdown — {r.processGroup}
      </p>
      <div className="flex flex-col gap-3 max-w-2xl">
        <Step n={1} title="Effective UPH"
          formula={`(3600 / ${r.bottleneckCtSec}s) × ${r.fpy} × ${r.efficiency} × ${(r.conversionPct * 100).toFixed(1)}% × ${r.qtyEquipment}`}
          legend="raw UPH · FPY · Efficiency · Conversion% · Machines"
          result={`${r.effectiveUph}`} />
        <Step n={2} title="IPK Units"
          formula={`(${r.uphUpstream} − ${r.uphDownstream}) × (${r.loadingQty} / ${r.uphUpstream})`}
          legend="UPH↑ − UPH↓ · Loading / UPH↑"
          result={`${r.ipkUnits} units`} />
        <Step n={3} title="WIP + Buffer"
          formula={`FLOOR(${r.ipkUnits} × ${bufferMult})`}
          legend="IPK units × (1 + buffer)"
          result={`${r.wipWithBuffer} units`} />
        <Step n={4} title="Trolleys"
          formula={`CEIL(${r.wipWithBuffer} / ${r.boardsPerTrolley} boards)`}
          legend="WIP / boards-per-trolley"
          result={`${r.ipkTrolleys} trolleys`} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-3">
        Raw UPH = 3600 / {r.bottleneckCtSec} = <span className="font-mono">{rawUph}</span> units/hr before yield &amp; efficiency.
      </p>
    </div>
  );
}

function Step({ n, title, formula, legend, result }: { n: number; title: string; formula: string; legend: string; result: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Step {n} — {title}</span>
        <span className="text-xs font-mono font-bold text-foreground">{result}</span>
      </div>
      <p className="text-[12px] font-mono text-foreground">{formula}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{legend}</p>
    </div>
  );
}

// ─── Inline editable cell ────────────────────────────────────────────────────
function EditCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value));
  if (!editing) {
    return (
      <button
        onClick={() => { setLocal(String(value)); setEditing(true); }}
        className="w-full h-full text-right font-mono text-[11px] text-foreground hover:bg-muted/60 rounded px-2 py-1 transition-colors tabular-nums"
      >
        {value}
      </button>
    );
  }
  return (
    <div className="px-1">
      <Input
        autoFocus type="number" value={local}
        className="h-7 w-14 text-right text-[11px] font-mono ml-auto"
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { onChange(Number(local) || 0); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onChange(Number(local) || 0); setEditing(false); } }}
      />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, valueClass, muted, signed }: {
  label: string; value: number; valueClass?: string; muted?: boolean; signed?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-3xl font-mono font-black mt-1 tabular-nums leading-none',
        valueClass ?? (muted ? 'text-muted-foreground' : 'text-foreground'))}>
        {signed && value > 0 ? `+${value}` : value}
      </p>
    </div>
  );
}
