/**
 * ImprovementPlan — the Q3 quadrant: corrective actions and who owns them.
 *
 * Two halves, used side by side: `ImprovementTable` renders the read view (and
 * the print/preview view), `ImprovementEditor` is the right-panel form.
 *
 * Shared, because none of the 11 columns are module-specific — Problem, Root
 * Cause, Containment, Corrective, Impact, ECN/PCN, FIA, Responsible, Commit
 * Date, Status is the same 8D-shaped grid whatever the losses are about.
 *
 * The only thing a module supplies is `issues`: the loss categories to group
 * under. OLE passes its top 2 man-hour buckets; Cycle Time passes its top
 * completion-loss reasons.
 */

import { PersonSearch } from '@/components/shared/PersonSearch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

export interface ActionItem {
  id: string;
  /** Which loss category this action sits under. Empty = ungrouped. */
  issue: string;
  problemDescription: string;
  rootCause: string;
  containmentAction: string;
  correctiveAction: string;
  impactPct: string;
  ecnPcn: string;
  fia: string;
  responsible: string;
  responsibleNtid?: string;
  responsibleEmail?: string;
  commitDate: string;
  status: string;
}

export const newActionItem = (issue: string): ActionItem => ({
  id: Math.random().toString(36).slice(2, 11),
  issue, problemDescription: '', rootCause: '', containmentAction: '',
  correctiveAction: '', impactPct: '', ecnPcn: '', fia: '',
  responsible: '', commitDate: '', status: 'Open',
});

// ─── Date field ───────────────────────────────────────────────────────────────

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYmd(s: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const [y, mo, d] = s.trim().split('-').map(Number);
  if (!y || !mo || !d) return undefined;
  return new Date(y, mo - 1, d);
}

function DatePickerField({ id, label, value, onChange }: {
  id: string; label: string; value: string; onChange: (ymd: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = fromYmd(value);
  return (
    <div className="w-full">
      <Label htmlFor={id} className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline"
            className={cn('mt-1 w-full h-7 justify-start text-left font-normal px-2 text-xs shadow-none', !value && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{date ? format(date, 'MMM d, yyyy') : 'Any date'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} defaultMonth={date}
            onSelect={d => { onChange(d ? toYmd(d) : ''); setOpen(false); }} initialFocus />
          {value && (
            <div className="border-t border-border p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full h-8 text-xs"
                onClick={() => { onChange(''); setOpen(false); }}>Clear date</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Read / print view ────────────────────────────────────────────────────────

const COLS = [
  { label: 'Issue', th: 'sticky left-0 bg-primary z-10 w-20 max-w-[80px]' },
  { label: 'Problem Description', th: 'min-w-[100px]' }, { label: 'Root Cause', th: 'min-w-[90px]' },
  { label: 'Containment Action', th: 'min-w-[90px]' }, { label: 'Corrective & Preventive Actions', th: 'min-w-[90px]' },
  { label: 'Impact vs Overall', th: 'w-14 text-center' }, { label: 'ECN PCN NA', th: 'w-14 text-center' },
  { label: 'FIA - NA', th: 'w-14 text-center' }, { label: 'Responsible', th: 'w-16' },
  { label: 'Commit Date', th: 'w-16' }, { label: 'Status', th: 'w-14' },
];

const statusBadge = (s: string) => cn(
  'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border',
  s?.toLowerCase() === 'open' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
    s?.toLowerCase() === 'closed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
      s?.toLowerCase() === 'overdue' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
        'bg-muted text-muted-foreground border-border');

export interface ImprovementTableProps {
  actions: ActionItem[];
  /** Loss categories, in priority order — they lead the grouping even when empty. */
  issues?: string[];
  isPrint?: boolean;
}

// The preview sheet's quadrant frame draws the banner — see FourQPreview.
export function ImprovementTable({ actions, issues = [], isPrint = false }: ImprovementTableProps) {
  const sz = isPrint ? 'text-[10px]' : 'text-xs';
  const ph = isPrint ? 'px-1.5 py-1' : 'px-2 py-1.5';
  const pd = isPrint ? 'px-1.5 py-1.5' : 'px-2 py-2';

  const issueOrder: string[] = [];
  issues.filter(Boolean).forEach(c => { if (!issueOrder.includes(c)) issueOrder.push(c); });
  actions.forEach(a => { if (a.issue && !issueOrder.includes(a.issue)) issueOrder.push(a.issue); });
  const groups = issueOrder
    .map(issue => ({ issue, rows: actions.filter(a => a.issue === issue) }))
    .filter(g => g.rows.length > 0);
  const ungrouped = actions.filter(a => !a.issue);

  const dataCells = (a: ActionItem) => <>
    <td className={cn(pd, 'border border-border min-w-[100px]')}>{a.problemDescription || '-'}</td>
    <td className={cn(pd, 'border border-border min-w-[90px]')}>{a.rootCause || '-'}</td>
    <td className={cn(pd, 'border border-border min-w-[90px]')}>{a.containmentAction || '-'}</td>
    <td className={cn(pd, 'border border-border min-w-[90px]')}>{a.correctiveAction || '-'}</td>
    <td className={cn(pd, 'border border-border text-center w-14')}>{a.impactPct || '-'}</td>
    <td className={cn(pd, 'border border-border text-center w-14')}>{a.ecnPcn || '-'}</td>
    <td className={cn(pd, 'border border-border text-center w-14')}>{a.fia || '-'}</td>
    <td className={cn(pd, 'border border-border w-16')}>{a.responsible || '-'}</td>
    <td className={cn(pd, 'border border-border font-mono w-16')}>{a.commitDate || '-'}</td>
    <td className={cn(pd, 'border border-border w-14')}><span className={statusBadge(a.status)}>{a.status || 'Open'}</span></td>
  </>;

  return (
    <div className={cn('w-full overflow-x-auto', isPrint ? 'h-full' : 'rounded-xl bg-card')}>
      <table className={cn('w-full border-collapse text-left', sz, isPrint && 'h-full')}>
        <thead>
          <tr className="bg-primary text-primary-foreground uppercase">
            {COLS.map(c => (
              <th key={c.label} className={cn(ph, 'border border-primary/70 font-semibold leading-snug text-[8px]', c.th)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && ungrouped.length === 0
            ? <tr><td colSpan={11} className="px-3 py-8 text-center align-middle text-xs italic text-muted-foreground">
                No actions added - use the editor panel to add corrective actions
              </td></tr>
            : <>
              {groups.map(({ issue, rows }) => rows.map((a, ri) => (
                <tr key={a.id} className={cn('border-b border-border last:border-0 hover:bg-muted/40', ri % 2 === 1 && 'bg-muted/20')}>
                  {ri === 0 && (
                    <td rowSpan={rows.length}
                      className={cn(pd, 'border border-primary/70 font-semibold sticky left-0 bg-primary/10 z-10 w-20 max-w-[80px] align-middle leading-snug')}>
                      {issue}
                    </td>
                  )}
                  {dataCells(a)}
                </tr>
              )))}
              {ungrouped.map((a, ri) => (
                <tr key={a.id} className={cn('border-b border-border last:border-0 hover:bg-muted/40', ri % 2 === 1 && 'bg-muted/20')}>
                  <td className={cn(pd, 'border border-border sticky left-0 bg-card z-10 w-20')}>-</td>
                  {dataCells(a)}
                </tr>
              ))}
            </>}
        </tbody>
      </table>
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export interface ImprovementEditorProps {
  actions: ActionItem[];
  onChange: (next: ActionItem[]) => void;
  /** One section per issue. Blank entries still render, labelled by position. */
  issues: string[];
  blurb?: string;
}

export function ImprovementEditor({
  actions, onChange, issues,
  blurb = 'Track corrective actions for top loss categories.',
}: ImprovementEditorProps) {
  return (
    <div className="m-0 space-y-6">
      <p className="text-[11px] text-muted-foreground">{blurb}</p>
      {issues.map((cat, catIdx) => (
        <div key={catIdx} className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-1">
            <h3 className="text-xs font-bold uppercase text-primary flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center text-[10px]">{catIdx + 1}</span>
              {cat || `Top Loss Category ${catIdx + 1}`}
            </h3>
            <Button variant="outline" size="sm"
              className="h-7 text-[10px] px-2 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
              onClick={() => onChange([...actions, newActionItem(cat)])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Action
            </Button>
          </div>

          <Accordion type="multiple" className="w-full space-y-2">
            {actions.filter(a => a.issue === cat).map(a => {
              const gi = actions.findIndex(x => x.id === a.id);
              const update = (fields: Partial<ActionItem>) => {
                const n = [...actions];
                n[gi] = { ...n[gi], ...fields };
                onChange(n);
              };
              return (
                <AccordionItem key={a.id} value={a.id} className="border border-border rounded-xl bg-card overflow-hidden shadow-sm group/item">
                  <div className="flex items-center relative hover:bg-muted/20 transition-colors">
                    <AccordionTrigger className="hover:no-underline px-4 py-3 group flex-1 [&>svg]:order-first [&>svg]:mr-3 justify-start">
                      <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', a.status === 'Closed' ? 'bg-emerald-500' : 'bg-amber-500')} />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-bold text-foreground truncate">{a.problemDescription || 'New Action...'}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{a.responsible || 'No Owner'} · {a.status}</span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <Button variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 absolute right-2 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/item:opacity-100 transition-opacity"
                      onClick={e => { e.stopPropagation(); onChange(actions.filter(x => x.id !== a.id)); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <AccordionContent className="px-4 pb-4 space-y-4 border-t border-border pt-4 bg-muted/20">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Problem Description</Label>
                        <Input value={a.problemDescription} onChange={e => update({ problemDescription: e.target.value })}
                          placeholder="New Problem..." className="h-7 text-xs bg-background" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Responsible</Label>
                        {a.responsible ? (
                          <div className="flex h-7 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs">
                            <span className="truncate">{a.responsible}</span>
                            {a.responsibleNtid && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{a.responsibleNtid}</span>}
                            <button type="button" title="Clear owner" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => update({ responsible: '', responsibleNtid: '', responsibleEmail: '' })}>
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          /* ntid + email are carried alongside the name so the task can be emailed later. */
                          <PersonSearch placeholder="Search anyone by name or NTID..." onPick={pn => update({
                            responsible: pn.legalName ?? pn.ntid ?? '',
                            responsibleNtid: pn.ntid ?? '', responsibleEmail: pn.email ?? '',
                          })} />
                        )}
                      </div>
                    </div>

                    {([
                      ['Root Cause', 'rootCause', 40],
                      ['Containment Action', 'containmentAction', 40],
                      ['Corrective & Preventive Actions', 'correctiveAction', 60],
                    ] as const).map(([label, field, minH]) => (
                      <div key={field} className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
                        <textarea value={a[field]} onChange={e => update({ [field]: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          style={{ minHeight: minH }} />
                      </div>
                    ))}

                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ['Impact %', 'impactPct', 'e.g. 15%'],
                        ['ECN/PCN', 'ecnPcn', 'N/A'],
                        ['FIA', 'fia', 'N/A'],
                      ] as const).map(([label, field, placeholder]) => (
                        <div key={field} className="space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
                          <Input value={a[field]} onChange={e => update({ [field]: e.target.value })}
                            placeholder={placeholder} className="h-7 text-xs bg-background" />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <DatePickerField id={`cd-${a.id}`} label="Commit Date" value={a.commitDate}
                        onChange={val => update({ commitDate: val })} />
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Status</Label>
                        <select value={a.status} onChange={e => update({ status: e.target.value })}
                          className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <option value="Open">Open</option><option value="Closed">Closed</option>
                        </select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {actions.filter(a => a.issue === cat).length === 0 && (
            <div className="py-4 border-2 border-dashed border-border rounded-xl flex items-center justify-center">
              <p className="text-[11px] text-muted-foreground">No actions for this category.</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
