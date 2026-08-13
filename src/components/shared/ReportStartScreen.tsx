/**
 * ReportStartScreen — the landing state of a saved-report page.
 *
 * Deliberately two choices and nothing else. Scope pickers, week counts and the
 * saved list all used to compete for attention here; they're one click away now.
 *
 * Shared by OLE 4Q and Cycle Time 4Q — only the icon and wording differ.
 */

import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { SavedReportMeta } from '@/lib/shared/savedReportsApi';
import type { LucideIcon } from 'lucide-react';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export interface ReportStartScreenProps {
  /** Big mark above the title — the module's own icon. */
  icon: LucideIcon;
  title: string;
  /** Optional status pill beside the title — e.g. "Testing Phase". */
  badge?: string;
  subtitle: string;
  savedList: SavedReportMeta[];
  onNew: () => void;
  onLoad: (id: number) => void;
  onDeleteSave: (id: number) => void;
  loading?: boolean;
}

export function ReportStartScreen({
  icon: Icon, title, badge, subtitle, savedList, onNew, onLoad, onDeleteSave, loading = false,
}: ReportStartScreenProps) {
  const [picking, setPicking] = useState(false);
  const hasSaves = savedList.length > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-8">
      <Icon className="h-20 w-20 text-primary mb-7" strokeWidth={1.25} />

      {/* Badge sits on the baseline, not scaled with the 5xl title — a pill that
          big stops reading as a note and starts competing with the name. */}
      <h2 className="flex items-center gap-3 text-5xl font-semibold tracking-tight text-foreground">
        {title}
        {badge && (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {badge}
          </span>
        )}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p>

      {/* No card chrome: the icons ARE the affordance. Two choices, nothing else. */}
      <div className="mt-12 flex items-start gap-12">
        <button onClick={onNew} disabled={loading}
          className="group flex flex-col items-center gap-2.5 disabled:opacity-50 transition-opacity">
          <Plus className="h-11 w-11 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2} />
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Create new</span>
        </button>

        <button onClick={() => setPicking(true)} disabled={loading || !hasSaves}
          title={hasSaves ? 'Open a saved report' : 'No saved reports yet'}
          className="group flex flex-col items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
          <FolderOpen className="h-11 w-11 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2} />
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Load saved
            {hasSaves && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
                {savedList.length}
              </span>
            )}
          </span>
        </button>
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-w-md">
          <h3 className="text-base font-semibold mb-4">Saved reports</h3>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {savedList.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <button onClick={() => { setPicking(false); onLoad(s.id); }}
                  className="flex-1 text-left px-3 py-2 rounded-lg border border-border hover:border-primary/60 hover:bg-primary/5 transition-colors">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    saved {s.updated_at?.slice(0, 16).replace('T', ' ')}
                  </div>
                </button>
                <button onClick={() => onDeleteSave(s.id)} title="Delete"
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted/60 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
