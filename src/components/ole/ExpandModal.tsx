/**
 * ExpandModal.tsx
 * ───────────────
 * Generic full-bleed modal used by ChartCard to render an "expanded"
 * view of a chart. Larger than TrendModal (74vw × 72vh).
 */

import { useEscapeKey } from '@/hooks/shared/useEscapeKey';
import { MODAL_DIM_LG } from '@/lib/ole/oleChartStyles';
import { X } from 'lucide-react';

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function ExpandModal({ title, open, onClose, children }: Props) {
  useEscapeKey(onClose, open);
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        style={{ transition: 'opacity 0.3s ease', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      <div
        className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col"
        style={{
          width: MODAL_DIM_LG.width,
          height: MODAL_DIM_LG.height,
          top: '50%',
          left: '50%',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          opacity: open ? 1 : 0,
          transform: open ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -52%) scale(0.96)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</span>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 p-5 flex flex-col">{children}</div>
      </div>
    </>
  );
}
