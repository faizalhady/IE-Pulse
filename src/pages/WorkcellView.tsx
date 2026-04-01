import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWorkcells, useProductionSummary, useAssemblies } from '@/hooks/useMesData';
import { StatusDot } from '@/components/StatusIndicator';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getStatusLevel } from '@/types';
import type { StatusLevel } from '@/types';

const STATUS_COLOR: Record<StatusLevel, string> = {
  optimal:  'text-emerald-500',
  warning:  'text-amber-400',
  critical: 'text-red-400',
  idle:     'text-muted-foreground',
};
const STATUS_BADGE: Record<StatusLevel, string> = {
  optimal:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning:  'bg-amber-500/15  text-amber-400  border-amber-500/30',
  critical: 'bg-red-500/15    text-red-400    border-red-500/30',
  idle:     'bg-muted         text-muted-foreground border-border',
};
const STATUS_LABEL: Record<StatusLevel, string> = {
  optimal: 'Active', warning: 'Warning', critical: 'Critical', idle: 'Idle',
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return iso; }
}

type TabKey = 'bays' | 'assemblies';

export default function WorkcellView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('bays');
  const [view, setView] = useState<'rows' | 'cards'>('rows');
  const [baySearch, setBaySearch] = useState('');
  const [asmSearch, setAsmSearch] = useState('');

  const { data: apiWorkcells, loading: wcLoading } = useWorkcells();
  const { data: apiProduction, loading: prodLoading, refetch } = useProductionSummary();

  const loading = wcLoading || prodLoading;

  // Find workcell from API
  const workcell = useMemo(
    () => apiWorkcells?.find(w => w.workcell_name === id) ?? null,
    [apiWorkcells, id]
  );

  // Fetch assemblies once we know the customer_id
  const { data: apiAssemblies, loading: asmLoading } = useAssemblies(
    workcell?.customer_id ?? null
  );

  // All production rows for this workcell = one row per bay
  const allBays = useMemo(
    () => (apiProduction ?? []).filter(p => p.workcell_name === id),
    [apiProduction, id]
  );

  const filteredBays = useMemo(() => {
    if (!baySearch.trim()) return allBays;
    const q = baySearch.toLowerCase();
    return allBays.filter(b => b.bay.toLowerCase().includes(q));
  }, [allBays, baySearch]);

  const filteredAsm = useMemo(() => {
    const list = Array.isArray(apiAssemblies) ? apiAssemblies : [];
    if (!asmSearch.trim()) return list;
    const q = asmSearch.toLowerCase();
    return list.filter(a =>
      a.product_number.toLowerCase().includes(q) ||
      a.product_name.toLowerCase().includes(q) ||
      a.family_name.toLowerCase().includes(q) ||
      a.revision.toLowerCase().includes(q)
    );
  }, [apiAssemblies, asmSearch]);

  const totalOutput   = allBays.reduce((s, b) => s + (b.total_output ?? 0), 0);
  const activeBays    = allBays.filter(b => (b.total_output ?? 0) > 0).length;
  const perBayProd    = allBays.map(b =>
    b.total_steps ? Math.min(100, Math.round((b.total_output / b.total_steps) * 100)) : 0
  );
  const avgProductivity = perBayProd.length
    ? (perBayProd.reduce((s, v) => s + v, 0) / perBayProd.length).toFixed(1)
    : '0';
  const wcStatus: StatusLevel = getStatusLevel(parseFloat(avgProductivity));

  if (loading && !workcell) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!loading && !workcell) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-64 text-muted-foreground">
        <p className="text-sm">Workcell <span className="font-mono text-foreground">"{id}"</span> not found.</p>
        <button onClick={() => navigate('/workcells')} className="text-xs text-primary underline">← Back to Workcells</button>
      </div>
    );
  }

  return (
    <div className="space-y-0">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">

        {/* Breadcrumb row */}
        <div className="flex items-center justify-between px-1 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-foreground transition-colors mr-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <span className="text-border">|</span>
            <Link to="/workcells" className="hover:text-foreground transition-colors">Workcells</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{id}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refetch}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
            {/* View toggle — only for Bays tab */}
            {tab === 'bays' && (
              <div className="flex items-center gap-1 border border-border rounded-lg p-1">
                <button onClick={() => setView('rows')} className={cn('px-3 py-1.5 text-xs rounded-md transition-colors font-medium', view === 'rows' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>List</button>
                <button onClick={() => setView('cards')} className={cn('px-3 py-1.5 text-xs rounded-md transition-colors font-medium', view === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Cards</button>
              </div>
            )}
          </div>
        </div>

        {/* Title row */}
        <div className="flex items-center gap-3 px-1 pb-2">
          <h1 className="text-xl font-semibold text-foreground">{id}</h1>
          <span className={cn('text-2xl font-mono font-bold', STATUS_COLOR[wcStatus])}>{avgProductivity}%</span>
          <span className="text-xs text-muted-foreground">{allBays.length} bays · {(apiAssemblies ?? []).length} assemblies</span>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 pb-2 text-xs font-mono">
          <span className="text-muted-foreground">Active: <span className="text-foreground font-semibold">{activeBays}/{allBays.length}</span></span>
          <span className="text-muted-foreground">Output: <span className="text-foreground font-semibold">{totalOutput.toLocaleString()}</span></span>
          <span className="text-muted-foreground">Customer ID: <span className="text-foreground font-semibold">{workcell?.customer_id}</span></span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 px-1 border-b border-border -mb-px">
          {([
            { key: 'bays'       as TabKey, label: 'Bays',          count: allBays.length },
            { key: 'assemblies' as TabKey, label: 'All Assemblies', count: (apiAssemblies ?? []).length },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 flex items-center gap-2',
                tab === t.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                tab === t.key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-6 pt-4 pb-6 space-y-3">

        {/* ── BAYS TAB ── */}
        {tab === 'bays' && (
          <>
            {/* Search */}
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={baySearch}
                onChange={e => setBaySearch(e.target.value)}
                placeholder="Search bays…"
                className="pl-8 h-9"
              />
            </div>

            {filteredBays.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm rounded-xl border border-border">
                {baySearch ? 'No bays match your search.' : 'No bay data available.'}
              </div>
            ) : view === 'rows' ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 5rem 6rem 7rem 7rem 7rem' }}>
                  <div className="px-4 py-3">Bay</div>
                  <div className="px-3 py-3 text-center">Batches</div>
                  <div className="px-3 py-3 text-center">Assemblies</div>
                  <div className="px-3 py-3 text-center">Output</div>
                  <div className="px-3 py-3 text-center">Productivity</div>
                  <div className="px-3 py-3 text-center">Status</div>
                </div>
                {filteredBays.map((bay, idx) => {
                  const pct = bay.total_steps
                    ? Math.min(100, Math.round((bay.total_output / bay.total_steps) * 100)) : 0;
                  const status = getStatusLevel(pct);
                  const lastSeen = bay.latest_activity
                    ? new Date(bay.latest_activity).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    : '—';
                  const barColor = status === 'optimal' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-400' : status === 'critical' ? 'bg-red-500' : 'bg-muted';
                  return (
                    <button
                      key={`${bay.bay}-${idx}`}
                      onClick={() => navigate(`/bay/${encodeURIComponent(id!)}__${encodeURIComponent(bay.bay)}`)}
                      className="w-full grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors text-left group"
                      style={{ gridTemplateColumns: '1fr 5rem 6rem 7rem 7rem 7rem' }}
                    >
                      <div className="px-4 py-3.5 flex items-center gap-3">
                        <StatusDot status={status} />
                        <div>
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{bay.bay}</p>
                          <p className="text-xs text-muted-foreground">Last: {lastSeen}</p>
                        </div>
                      </div>
                      <div className="px-3 py-3.5 text-center font-mono text-sm text-foreground">{bay.total_batches}</div>
                      <div className="px-3 py-3.5 text-center font-mono text-sm text-foreground">{bay.total_assemblies}</div>
                      <div className="px-3 py-3.5 text-center">
                        <span className="font-mono font-semibold text-foreground">{bay.total_output.toLocaleString()}</span>
                        <p className="text-[10px] text-muted-foreground">units</p>
                      </div>
                      <div className="px-3 py-3.5 text-center">
                        <span className={cn('text-lg font-mono font-bold', STATUS_COLOR[status])}>{pct}%</span>
                        <div className="mt-1 h-1 rounded-full bg-muted/50 overflow-hidden">
                          <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="px-3 py-3.5 flex justify-center">
                        <span className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full border', STATUS_BADGE[status])}>
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBays.map((bay, idx) => {
                  const pct = bay.total_steps
                    ? Math.min(100, Math.round((bay.total_output / bay.total_steps) * 100)) : 0;
                  const status = getStatusLevel(pct);
                  const lastSeen = bay.latest_activity
                    ? new Date(bay.latest_activity).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                    : '—';
                  return (
                    <button
                      key={`${bay.bay}-${idx}`}
                      onClick={() => navigate(`/bay/${encodeURIComponent(id!)}__${encodeURIComponent(bay.bay)}`)}
                      className="rounded-xl border border-border bg-card p-4 space-y-3 text-left w-full hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusDot status={status} />
                          <span className="font-semibold text-foreground">{bay.bay}</span>
                        </div>
                        <span className={cn('text-[10px] font-semibold px-2.5 py-1 rounded-full border', STATUS_BADGE[status])}>
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className={cn('text-3xl font-mono font-bold', STATUS_COLOR[status])}>{pct}%</span>
                        <span className="text-xs text-muted-foreground">Last: {lastSeen}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full', status === 'optimal' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-400' : status === 'critical' ? 'bg-red-500' : 'bg-muted')} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        {[
                          { label: 'Output',     value: bay.total_output.toLocaleString() },
                          { label: 'Batches',    value: bay.total_batches },
                          { label: 'Assemblies', value: bay.total_assemblies },
                        ].map(s => (
                          <div key={s.label}>
                            <p className="text-[10px] text-muted-foreground">{s.label}</p>
                            <p className="text-sm font-mono font-semibold text-foreground">{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── ASSEMBLIES TAB ── */}
        {tab === 'assemblies' && (
          <>
            {/* Search */}
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={asmSearch}
                onChange={e => setAsmSearch(e.target.value)}
                placeholder="Search assemblies…"
                className="pl-8 h-9"
              />
            </div>

            {asmLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : filteredAsm.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm rounded-xl border border-border">
                {asmSearch ? 'No assemblies match your search.' : 'No assemblies found for this workcell.'}
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <div
                  className="grid bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium uppercase tracking-wider"
                  style={{ gridTemplateColumns: '1fr 1.6fr 5rem 7rem 7rem' }}
                >
                  <div className="px-4 py-3">Product No.</div>
                  <div className="px-3 py-3">Product Name</div>
                  <div className="px-3 py-3 text-center">Revision</div>
                  <div className="px-3 py-3 text-center">Family</div>
                  <div className="px-3 py-3 text-center">Last Updated</div>
                </div>
                {/* Rows */}
                {filteredAsm.map(a => (
                  <div
                    key={a.assembly_id}
                    className="grid items-center text-sm border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    style={{ gridTemplateColumns: '1fr 1.6fr 5rem 7rem 7rem' }}
                  >
                    <div className="px-4 py-3">
                      <p className="font-mono font-semibold text-foreground text-xs">{a.product_number}</p>
                    </div>
                    <div className="px-3 py-3">
                      <p className="text-foreground text-xs leading-snug">{a.product_name}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        {a.revision}
                      </span>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <span className="text-xs text-muted-foreground">{a.family_name}</span>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <span className="font-mono text-xs text-muted-foreground">{formatDate(a.last_updated_mes)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Row count */}
            {!asmLoading && (
              <p className="text-xs text-muted-foreground text-right">
                {filteredAsm.length} of {(apiAssemblies ?? []).length} assemblies
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
