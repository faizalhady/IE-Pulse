/**
 * ReportDrawer — the 4Q editor's right-hand panel: a collapsible column with a
 * tab strip, the same shape as OLE's "Data Editor". Cycle Time and VA/NVA share
 * this one. Tabs are slots — the page decides what each holds (plan editor,
 * settings, …); this owns the chrome, nothing about the content.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DrawerTab {
  value: string;
  label: string;
  content: ReactNode;
  /** Active-underline colour class. Defaults to the primary. */
  accent?: string;
  /** Push to the far right — where Settings sits on OLE's strip. */
  end?: boolean;
}

export function ReportDrawer({ open, onToggle, title = 'Report Editor', tabs, defaultTab = tabs[0]?.value }: {
  open: boolean;
  onToggle: () => void;
  title?: string;
  tabs: DrawerTab[];
  defaultTab?: string;
}) {
  return (
    <div className={cn('z-10 flex flex-shrink-0 flex-col border-l border-border bg-card/95 shadow-xl backdrop-blur-sm transition-all duration-300',
      open ? 'w-[460px]' : 'w-12')}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? 'Collapse editor' : 'Expand editor'}
        className={cn('group flex flex-shrink-0 cursor-pointer items-center border-b border-border transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          open ? 'justify-between px-5' : 'justify-center')}
        style={{ height: 52 }}>
        {open && <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</span>}
        <span className="rounded-md bg-muted p-1.5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {open ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </span>
      </button>

      {open && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <Tabs defaultValue={defaultTab} className="flex h-full min-h-0 flex-col">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-x-4 gap-y-2 rounded-none border-b border-border bg-transparent p-0 pb-2">
              {tabs.map(t => (
                <TabsTrigger key={t.value} value={t.value}
                  className={cn('rounded-none border-b-2 border-transparent px-1 py-1 text-xs shadow-none data-[state=active]:bg-transparent',
                    t.accent ?? 'data-[state=active]:border-primary', t.end && 'ml-auto')}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="mt-4 flex-1 overflow-y-auto pr-2">
              {tabs.map(t => (
                <TabsContent key={t.value} value={t.value} className="m-0">{t.content}</TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}
