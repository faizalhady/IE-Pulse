/**
 * YamazumiTab.tsx — full-size Yamazumi chart + legend.
 */

import {
  YAMAZUMI_MACHINE_COLOR, YAMAZUMI_NVA_COLORS, YAMAZUMI_VA_COLORS,
} from '@/lib/lbr/lbrConstants';
import type { LBRPlaybook } from '../types';
import YamazumiChart from '../YamazumiChart';

export default function YamazumiTab({ playbook }: { playbook: LBRPlaybook }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Yamazumi · {playbook.name}</p>
        <p className="text-[9px] text-muted-foreground">Bottleneck: <span className="text-red-400 font-semibold">{playbook.bottleneckStation}</span> · {playbook.bottleneckCt}s</p>
      </div>
      <div className="p-5">
        <YamazumiChart stations={playbook.stations} takt={playbook.takt} height={420} />
      </div>
      {/* Legend */}
      <div className="px-5 pb-4 flex flex-wrap items-center gap-4 border-t border-border pt-3">
        <LegendDot color={YAMAZUMI_VA_COLORS[0]} label="Value-Added (VA)" />
        <LegendDot color={YAMAZUMI_NVA_COLORS[0]} label="Non-Value-Added (NVA)" />
        <LegendDot color={YAMAZUMI_MACHINE_COLOR} label="Machine-only station" />
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="w-4 border-t-2 border-dashed border-red-500" /> TAKT</span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><span className="w-4 border-t-2 border-dashed border-amber-400" /> 95% TAKT (target)</span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} /> {label}
    </span>
  );
}
