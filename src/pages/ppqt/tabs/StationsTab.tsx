/**
 * StationsTab.tsx — "Which station drives it?" (PPQT sheet footer)
 *
 * Pick Area + Period. Stations are listed inside their line group; each
 * group header carries the BOTTLENECK column's result (need, CTI, PFTR).
 * Per station: demand through, WCT, takt, need, FPY·Eff, need with
 * allowances, have, variance, utilisation, crew, DL. Click → drawer with the
 * formula trace and the assemblies that load the station.
 *
 * Area / period / station live in the URL (?area=&period=&station=) so the
 * Summary tab and bookmarks can deep-link here.
 */

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { usePpqtStations } from '@/hooks/ppqt/usePpqt';
import type { PPQTMeta, PPQTStation } from '@/lib/ppqt/ppqtApi';
import { fmt, TONE_TEXT, utilTone, varianceTone } from '@/lib/ppqt/ppqtFormat';
import { cn } from '@/lib/utils';

import { Bar, CARD, Empty, ErrorBox, IssueBadge, Kpi, Loading, PeriodChips, ROW, Segmented, TD, TH } from '../ppqtUi';
import StationDrawer from '../StationDrawer';

const COLS: { label: string; tip: string; align?: 'left' }[] = [
  { label: 'Station', tip: 'Process column in the PPQT sheet', align: 'left' },
  { label: 'Demand', tip: 'Demand through = Σ demand of assemblies with CT > 0 at this station' },
  { label: 'WCT', tip: 'Weighted cycle time = Σ(demand × CT) ÷ demand through' },
  { label: 'Takt', tip: 'Takt = available time in the period ÷ demand through' },
  { label: 'Need', tip: 'Resources needed = WCT ÷ Takt' },
  { label: 'FPY·Eff', tip: 'Allowance inputs. Need × (1 + (1 − FPY×Eff))' },
  { label: 'Need +allow', tip: 'Resources NEEDED with allowances — the number the report uses' },
  { label: 'Have', tip: 'Lines available (Exe Summaries) or equipment available (sheet footer)' },
  { label: 'Var', tip: 'Have − ROUNDUP(Need +allow + NPI). Negative = short' },
  { label: 'Util', tip: 'Need +allow ÷ Have' },
  { label: 'Crew', tip: '# of crew (Exe Summaries)' },
  { label: 'DL', tip: 'DL required = Need +allow × crew' },
];

export function useAreaPeriod(meta: PPQTMeta) {
  const [sp, setSp] = useSearchParams();
  const areaParam = sp.get('area');
  const periodParam = sp.get('period');
  const area = areaParam && meta.areas.some((a) => a.code === areaParam) ? areaParam : meta.areas[0]?.code ?? '';
  const period = periodParam && meta.periods.includes(periodParam) ? periodParam : meta.latest ?? meta.periods[meta.periods.length - 1] ?? '';
  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };
  return { area, period, station: sp.get('station'), set };
}

export default function StationsTab({ workcell, meta }: { workcell: string; meta: PPQTMeta }) {
  const { area, period, station, set } = useAreaPeriod(meta);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | 'bays'>('all');
  const { data, isLoading, isFetching, isError, error } = usePpqtStations(workcell, area, period);

  const groups = useMemo(() => {
    const rows = data?.stations ?? [];
    const needle = q.trim().toLowerCase();
    const out: { group_no: number; line_group: string; bottleneck?: PPQTStation; members: PPQTStation[] }[] = [];
    for (const s of rows) {
      let g = out.find((x) => x.group_no === s.group_no);
      if (!g) { g = { group_no: s.group_no, line_group: s.line_group, members: [] }; out.push(g); }
      if (s.is_bottleneck) { g.bottleneck = s; continue; }
      if (scope === 'bays' && !s.is_bay) continue;
      if (needle && !s.header.toLowerCase().includes(needle) && !(s.bay ?? '').toLowerCase().includes(needle)) continue;
      g.members.push(s);
    }
    return out.filter((g) => g.members.length > 0);
  }, [data, q, scope]);

  const all = data?.stations ?? [];
  const short = all.filter((s) => !s.is_bottleneck && s.variance != null && s.variance < 0);
  const flagged = all.filter((s) => s.issues).length;
  const selected = station ? all.find((s) => s.station === station) ?? null : null;

  return (
    <div className="space-y-3 p-5">
      {/* ─── Controls ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented ariaLabel="Area" value={area} onChange={(v) => set('area', v)}
                   options={meta.areas.map((a) => ({ value: a.code, label: a.label }))} />
        <PeriodChips periods={meta.periods} value={period} onChange={(v) => set('period', v)} />
        <Segmented size="sm" ariaLabel="Scope" value={scope} onChange={(v) => setScope(v)}
                   options={[{ value: 'all', label: 'All stations' }, { value: 'bays', label: 'DL bays only', hint: 'Stations that appear in the Exe Summaries DL report' }]} />
        <label className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find station…" aria-label="Find station"
            className="h-8 w-48 rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {/* ─── Area / period KPIs ──────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Kpi label="Demand (units)" value={fmt.int(data.totals.total_demand)} sub={`${data.totals.with_demand} of ${data.totals.assemblies} assemblies`} />
          <Kpi label="Load (demand × lead time)" value={fmt.hrs(data.totals.demand_x_lead_hrs)} sub="all stations, this area" />
          <Kpi label="Stations" value={all.filter((s) => !s.is_bottleneck).length} sub={`${data.line_groups.length} line groups`} />
          <Kpi label="Short" value={short.length} tone={short.length ? 'short' : 'ok'} sub="have < total requirement" />
          <Kpi label="Broken cells" value={flagged} tone={flagged ? 'tight' : 'ok'} sub={flagged ? 'sheet computes 0 there' : 'workbook footer is clean'} />
        </div>
      )}

      {/* ─── Table ───────────────────────────────────────────────────── */}
      <div className={cn(CARD, 'overflow-hidden', isFetching && 'opacity-70')}>
        {isLoading ? (
          <Loading label="Computing stations…" />
        ) : isError ? (
          <ErrorBox error={error} />
        ) : groups.length === 0 ? (
          <Empty>No station matches.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  {COLS.map((c) => (
                    <th key={c.label} title={c.tip} className={cn(TH, c.align === 'left' && 'text-left')}>{c.label}</th>
                  ))}
                  <th className={TH} aria-label="flags" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupBlock key={g.group_no} g={g} onOpen={(s) => set('station', s.station)} selected={station} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StationDrawer
        workcell={workcell} area={area} period={period}
        station={selected}
        onClose={() => set('station', null)}
      />
    </div>
  );
}

function GroupBlock({ g, onOpen, selected }: {
  g: { group_no: number; line_group: string; bottleneck?: PPQTStation; members: PPQTStation[] };
  onOpen: (s: PPQTStation) => void; selected: string | null;
}) {
  const b = g.bottleneck;
  const noCoTime = !b?.issues && b?.cti_co_time_hrs != null && b.cti_co_time_hrs < 0;
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={COLS.length + 1} className="px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-[12px] font-semibold text-foreground">{g.line_group}</span>
            {b && (
              <>
                <span className="text-[11px] text-muted-foreground" title="BOTTLENECK column: MAX(CT) of this group per assembly, sized like a station">
                  bottleneck need <b className="tabular-nums text-foreground">{fmt.num(b.need_allow, 2)}</b>
                </span>
                <span className="text-[11px] text-muted-foreground" title="Hours required to run the demand through the bottleneck ÷ hours available with allowances">
                  load <b className="tabular-nums text-foreground">{fmt.hrs(b.cti_required_hrs)}</b> of {fmt.hrs(b.cti_avail_allow_hrs)}
                </span>
                {b.cti_days != null && b.cti_days > 0 ? (
                  <span className="text-[11px] text-muted-foreground" title="CTI: how often the whole mix can be run (days). PFTR = CTI ÷ days in period">
                    CTI <b className="tabular-nums text-foreground">{fmt.num(b.cti_days, 1)} d</b> · PFTR <b className="tabular-nums text-foreground">{fmt.num(b.pftr, 2)}</b>
                  </span>
                ) : noCoTime ? (
                  <span className={cn('text-[11px] font-semibold', TONE_TEXT.short)}>no time for changeovers</span>
                ) : null}
                <IssueBadge issues={b.issues} />
              </>
            )}
          </div>
        </td>
      </tr>
      {g.members.map((s) => {
        const vt = varianceTone(s.variance);
        const ut = utilTone(s.util);
        return (
          <tr
            key={s.station}
            onClick={() => onOpen(s)}
            className={cn(ROW, 'cursor-pointer', selected === s.station && 'bg-primary/10')}
          >
            <td className={cn(TD, 'text-left font-medium text-foreground')}>
              {s.header}
              {s.is_bay && <span className="ml-1.5 rounded bg-primary/10 px-1 py-px text-[9px] font-semibold uppercase text-primary" title="Appears in the DL report (Exe Summaries)">DL</span>}
            </td>
            <td className={cn(TD, 'text-foreground')}>{fmt.int(s.demand_through)}</td>
            <td className={cn(TD, 'text-foreground')}>{fmt.sec(s.wct)}</td>
            <td className={cn(TD, 'text-foreground')}>{fmt.sec(s.takt)}</td>
            <td className={cn(TD, 'text-foreground')}>{fmt.num(s.need, 2)}</td>
            <td className={cn(TD, 'text-muted-foreground')}>{fmt.num(s.fpy, 2)}·{fmt.num(s.eff, 2)}</td>
            <td className={cn(TD, 'font-semibold text-foreground')}>{fmt.num(s.need_allow, 2)}</td>
            <td className={cn(TD, 'text-foreground')}>{s.available == null ? '—' : fmt.int(s.available)}</td>
            <td className={cn(TD, 'font-semibold', TONE_TEXT[vt])}>{fmt.signed(s.variance)}</td>
            <td className={TD}>
              <div className="flex items-center justify-end gap-1.5">
                <span className={cn('tabular-nums', TONE_TEXT[ut])}>{fmt.pct(s.util, 0)}</span>
                <Bar pct={s.util == null ? null : s.util * 100} tone={ut} className="w-12" />
              </div>
            </td>
            <td className={cn(TD, 'text-muted-foreground')}>{s.crew == null ? '—' : fmt.int(s.crew)}</td>
            <td className={cn(TD, 'text-foreground')}>{s.dl_required == null ? '—' : fmt.num(s.dl_required, 1)}</td>
            <td className="px-2"><IssueBadge issues={s.issues} /></td>
          </tr>
        );
      })}
    </>
  );
}
