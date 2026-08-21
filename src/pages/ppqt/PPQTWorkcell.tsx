/**
 * PPQTWorkcell.tsx
 * ────────────────
 * Route: /ppqt/:workcell/:tab?   — the dedicated PPQT report for one workcell.
 *
 * Storyline (P·P·Q·T read backwards, from the answer to the assumptions):
 *   Summary     Do we have enough DL and equipment for the demand?   (Exe Summaries)
 *   Stations    Which station drives it?                             (PPQT sheet footer)
 *   Assemblies  Which product drives the station?                    (PPQT sheet body)
 *   Inputs      Where do the numbers come from?                      (footer + Exe Summaries)
 */

import { ArrowLeft, Boxes, ClipboardList, Cpu, SlidersHorizontal } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { UnderlineTabs } from '@/components/shared/UnderlineTabs';
import { usePpqtMeta } from '@/hooks/ppqt/usePpqt';
import { fmt } from '@/lib/ppqt/ppqtFormat';
import { getWorkcellLogo, getWorkcellLogoBg } from '@/lib/ole/oleConstants';

import { ErrorBox, Loading } from './ppqtUi';
import AssembliesTab from './tabs/AssembliesTab';
import InputsTab from './tabs/InputsTab';
import StationsTab from './tabs/StationsTab';
import SummaryTab from './tabs/SummaryTab';

const TABS = [
  { key: 'summary',    label: 'Summary',    icon: ClipboardList,
    tip: 'Do we have enough DL and equipment for the demand? DL required vs actual, variance, NVA — per bay, three periods side by side' },
  { key: 'stations',   label: 'Stations',   icon: Cpu,
    tip: 'Which station drives it — demand through, weighted cycle time, takt, resources needed vs available, per line group' },
  { key: 'assemblies', label: 'Assemblies', icon: Boxes,
    tip: 'Which product drives the station — demand and cycle time per station, bottleneck and lead time per assembly' },
  { key: 'inputs',     label: 'Inputs',     icon: SlidersHorizontal,
    tip: 'Where the numbers come from — shift hours, days, changeovers, FPY, efficiency, equipment, crew, NPI, actual DL' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const isTab = (t: string | undefined): t is TabKey => TABS.some((x) => x.key === t);

export default function PPQTWorkcell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { workcell = '', tab: rawTab } = useParams();
  const tab: TabKey = isTab(rawTab) ? rawTab : 'summary';
  const { data: meta, isLoading, isError, error } = usePpqtMeta(workcell);

  const setTab = (key: TabKey) =>
    navigate({ pathname: `/ppqt/${encodeURIComponent(workcell)}/${key}`, search: location.search }, { replace: true });

  const logo = getWorkcellLogo(workcell);
  const subtitle = meta
    ? `${meta.areas.map((a) => a.label).join(' · ')}  —  ${meta.periods.map(fmt.period).join(', ')}`
    : 'PPQT capacity analysis';
  const file = meta?.files[meta.files.length - 1];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border">
        <div className="flex items-center justify-between gap-4 px-6 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/ppqt')}
              title="All workcells"
              aria-label="Back to all workcells"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {logo ? (
              <div className="flex h-10 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border"
                   style={{ backgroundColor: getWorkcellLogoBg(workcell) ?? '#ffffff' }}>
                <img src={logo} alt={workcell} className="h-full w-full object-contain p-1" />
              </div>
            ) : (
              <div className="flex h-10 w-24 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                <span className="text-xs font-bold text-muted-foreground">{workcell.slice(0, 3).toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-foreground">{workcell}</h1>
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {file && (
            <div className="hidden min-w-0 max-w-[22rem] text-right md:block">
              <div className="truncate text-[11px] text-foreground" title={file.file}>{file.file}</div>
              <div className="text-[10px] text-muted-foreground">
                {file.sheets} sheets read · parsed {fmt.datetime(file.ingested_at)}
              </div>
            </div>
          )}
        </div>
        <div className="px-6">
          <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <Loading label="Loading workcell…" />
        ) : isError || !meta ? (
          <ErrorBox error={error ?? new Error('Workcell not found')} />
        ) : tab === 'summary' ? (
          <SummaryTab workcell={workcell} meta={meta} />
        ) : tab === 'stations' ? (
          <StationsTab workcell={workcell} meta={meta} />
        ) : tab === 'assemblies' ? (
          <AssembliesTab workcell={workcell} meta={meta} />
        ) : (
          <InputsTab workcell={workcell} meta={meta} />
        )}
      </div>
    </div>
  );
}
