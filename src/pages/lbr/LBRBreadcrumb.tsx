/**
 * LBRBreadcrumb.tsx
 * ──────────────────
 * Shared breadcrumb for LBR deep-link pages (mirrors PPQTBreadcrumb).
 *
 *   ← Back · LBR / BD PCA / ASPCA-01133 / 6-op High Demand
 *
 * Each non-final segment is clickable; the workcell logo shows next to the
 * workcell segment so customer identity persists across layers.
 */

import { getWorkcellLogo } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;             // omit on the last item (current page)
  workcellLogoKey?: string;  // for the workcell segment — shows the logo
}

interface LBRBreadcrumbProps {
  items: BreadcrumbItem[];
  backHref?: string;
}

export default function LBRBreadcrumb({ items, backHref }: LBRBreadcrumbProps) {
  const navigate = useNavigate();
  const back = backHref ?? items[items.length - 2]?.href;

  return (
    <div className="flex items-center gap-2 text-xs">
      {back && (
        <button
          onClick={() => navigate(back)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}
      {back && <span className="text-border">·</span>}

      <nav className="flex items-center gap-1 flex-wrap min-w-0">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const logo = item.workcellLogoKey ? getWorkcellLogo(item.workcellLogoKey) : null;
          return (
            <div key={`${item.label}-${i}`} className="flex items-center gap-1 min-w-0">
              {logo && (
                <span className="inline-flex w-6 h-3.5 rounded border border-border bg-white items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={logo} alt={item.label} className="w-full h-full object-contain p-px" />
                </span>
              )}
              {item.href && !isLast ? (
                <Link to={item.href} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                  {item.label}
                </Link>
              ) : (
                <span className={cn('truncate', isLast ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
