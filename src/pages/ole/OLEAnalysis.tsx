import { cn } from '@/lib/utils';
import { useState } from 'react';
import OLEProjection from './OLEProjection';
import OLEWorkcellTab from './OLEWorkcellTab';

export default function OLEAnalysis({ workcell, dateFrom, dateTo }: {
  workcell: string; dateFrom: string; dateTo: string;
}) {
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
      {sub === 'workcell'
        ? <OLEWorkcellTab workcell={workcell} dateFrom={dateFrom} dateTo={dateTo} />
        : <OLEProjection />}
    </div>
  );
}
