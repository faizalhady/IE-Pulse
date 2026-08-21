/**
 * PPQTBreadcrumb.tsx
 * ───────────────────
 * Shared breadcrumb for PPQT deep-link pages.
 *
 * Renders a "← Back" link followed by the path:
 *   Dashboard / Wabtec / WAB SMT P1A-1 / SCR BOT 1 / 17FB130C6
 *
 * Each non-final segment is clickable. The workcell logo (if available)
 * shows next to the workcell name — keeps the customer identity persistent
 * across all deeper layers, mirroring the Fotmob team-crest-on-player-page
 * pattern.
 */

import { WORKCELL_LOGOS } from '@/lib/ole/oleConstants';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;             // omit on the last item (current page)
  workcellLogoKey?: string;  // for the workcell segment — shows the logo
}

interface PPQTBreadcrumbProps {
  items: BreadcrumbItem[];
  backHref?: string;         // explicit "← Back" target (defaults to the parent item's href)
}

function resolveLogo(workcell: string): string | null {
  const k = workcell.toLowerCase().replace(/[^a-z]/g, '');
  const lk = Object.keys(WORKCELL_LOGOS).find(x => k.startsWith(x));
  return lk ? WORKCELL_LOGOS[lk] : null;
}

export default function PPQTBreadcrumb({ items, backHref }: PPQTBreadcrumbProps) {
  const navigate = useNavigate();

  // The "back" target — second-to-last item by default
  const back = backHref ?? items[items.length - 2]?.href;

  return (
    <div className="flex items-center gap-2 text-xs">
      {back && (
        <button
          onClick={() => navigate(back)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      )}
      {back && <span className="text-border">·</span>}

      <nav className="flex items-center gap-1 flex-wrap min-w-0">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const logo = item.workcellLogoKey ? resolveLogo(item.workcellLogoKey) : null;

          return (
            <div key={`${item.label}-${i}`} className="flex items-center gap-1 min-w-0">
              {/* Workcell logo (only on the workcell segment) */}
              {logo && (
                <span className="inline-flex w-6 h-3.5 rounded border border-border bg-white items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={logo} alt={item.label} className="w-full h-full object-contain p-px" />
                </span>
              )}

              {/* Segment label */}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors truncate"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn('truncate', isLast ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                  {item.label}
                </span>
              )}

              {/* Separator chevron */}
              {!isLast && <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
