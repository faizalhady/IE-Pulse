/**
 * ChartCard.tsx
 * ─────────────
 * Card wrapper for charts with an Eye-icon button that opens an
 * ExpandModal showing `expandContent`. Owns its own open/close state.
 */

import { ExpandModal } from '@/components/ole/ExpandModal';
import { Eye } from 'lucide-react';
import { useCallback, useState } from 'react';

const CARD = 'bg-card border border-border rounded-lg p-4 flex flex-col';
const TITLE = 'text-xs font-semibold text-muted-foreground uppercase tracking-wider';

type Props = {
  title: string;
  className?: string;
  expandContent: React.ReactNode;
  children: React.ReactNode;
};

export function ChartCard({ title, className = '', expandContent, children }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <div className={`${CARD} ${className}`}>
        <div className="flex items-center justify-between mb-2 shrink-0">
          <p className={TITLE}>{title}</p>
          <button
            onClick={() => setOpen(true)}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Expand chart"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
      <ExpandModal title={title} open={open} onClose={close}>
        {expandContent}
      </ExpandModal>
    </>
  );
}
