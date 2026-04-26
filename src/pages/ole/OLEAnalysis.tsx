import { cn } from '@/lib/utils';
import { useState } from 'react';
import OLEFilters from './OLEFilters';
import OLEProjection from './OLEProjection';
import OLEWorkcellTab from './OLEWorkcellTab';

interface OLEAnalysisProps {
  search: string;
  setSearch: (v: string) => void;
  workcell: string;
  setWorkcell: (v: string) => void;
  plant: string;
  setPlant: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  workcellOptions: string[];
  rowCount: number;
}

export default function OLEAnalysis({
  search, setSearch,
  workcell, setWorkcell,
  plant, setPlant,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  workcellOptions,
  rowCount
}: OLEAnalysisProps) {
  const [sub, setSub] = useState<'workcell' | 'projection'>('workcell');

  return (
    <div>
      <div className="flex items-center gap-1 px-6 pt-4 pb-0">
        {(['workcell', 'projection'] as const).map(s => (
          <button key={s} onClick={() => setSub(s)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-medium border transition-all',
              sub === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground border-border hover:text-foreground'
            )}>
            {s === 'workcell' ? 'Workcell Analytics' : 'OLE Projection'}
          </button>
        ))}
      </div>

      {sub === 'workcell' ? (
        <>
          <OLEFilters
            search={search} setSearch={setSearch}
            workcell={workcell} setWorkcell={setWorkcell}
            plant={plant} setPlant={setPlant}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            workcellOptions={workcellOptions}
            rowCount={rowCount}
            activeTab="analysis"
          />
          <div className="px-6 pb-8 pt-0">
            <OLEWorkcellTab workcell={workcell} dateFrom={dateFrom} dateTo={dateTo} />
          </div>
        </>
      ) : (
        <div className="pb-8">
          <OLEProjection />
        </div>
      )}
    </div>
  );
}
