/**
 * SubmissionUpload.tsx — content of the "New upload" sheet.
 * Type selector (CONSO / Revenue / PRISM / Rate) → drop-zone → inferred-period +
 * validation preview → optional re-stage into an existing Pending/Rejected CONSO
 * batch → Upload & stage. Mock: filename-based period inference, mock staged-row
 * counts; no real parsing or credential entry.
 */

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { UPLOAD_KINDS, type Submission } from '@/pages/fsms/mockSubmissionsData';
import type { UploadKind } from '@/types/fsms';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

const MONTHS3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Issue = { level: 'error' | 'warning'; message: string };

function inferUpload(name: string, kind: UploadKind) {
  const issues: Issue[] = [];
  if (!name.toLowerCase().endsWith('.xlsx')) issues.push({ level: 'error', message: 'Only .xlsx files are accepted.' });
  let period_date: string | null = null;
  const m = name.match(/(\d{2})Q(\d)\s+([A-Za-z]{3})/);
  if (m) {
    const monIdx = MONTHS3.findIndex(x => x.toLowerCase() === m[3].toLowerCase());
    if (monIdx >= 0) {
      const fy = 2000 + Number(m[1]);
      const monthNum = monIdx + 1;
      const calYear = monthNum >= 9 ? fy - 1 : fy; // Jabil FY: Sep–Dec → FY−1
      period_date = `${calYear}-${String(monthNum).padStart(2, '0')}-01`;
    }
  } else if (kind === 'CONSO') {
    issues.push({ level: 'warning', message: 'Filename doesn’t match “YYQ# Mon …” — the period will be confirmed on parse.' });
  }
  const rowsToStage = kind === 'CONSO' ? 46 : kind === 'REVENUE' ? 312 : kind === 'PRISM' ? 540 : 4;
  return { period_date, issues, ok: !issues.some(i => i.level === 'error'), rowsToStage };
}

export default function SubmissionUpload({ onCreate, restageOptions, onClose }: {
  onCreate: (input: { kind: UploadKind; filename: string; period_date: string; plants: string[]; restageId?: string }) => void;
  restageOptions: Submission[];
  onClose: () => void;
}) {
  const [kind, setKind] = useState<UploadKind>('CONSO');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [restageId, setRestageId] = useState<string>('none');
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (file ? inferUpload(file.name, kind) : null), [file, kind]);
  const kindMeta = UPLOAD_KINDS.find(k => k.key === kind)!;

  const pick = (f: File | null | undefined) => { if (f) setFile(f); };

  const submit = () => {
    if (!file || !preview?.ok) return;
    onCreate({
      kind,
      filename: file.name,
      period_date: preview.period_date ?? new Date().toISOString().slice(0, 10),
      plants: kind === 'CONSO' ? ['P1', 'P2', 'BK'] : [],
      restageId: restageId !== 'none' ? restageId : undefined,
    });
    onClose();
  };

  return (
    <div className="space-y-5">
      {/* type selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Upload type</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {UPLOAD_KINDS.map(k => (
            <button key={k.key} onClick={() => { setKind(k.key); setRestageId('none'); }}
              className={cn('rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                kind === k.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{kindMeta.hint}</p>
      </div>

      {/* drop-zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setDragging(false); }}
        onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
        className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-muted/20')}
      >
        <input ref={inputRef} type="file" accept=".xlsx" className="sr-only" onChange={e => pick(e.target.files?.[0])} />
        {file ? (
          <>
            <FileSpreadsheet className="h-7 w-7 text-primary" />
            <div className="text-sm font-medium text-foreground break-all">{file.name}</div>
            <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
          </>
        ) : (
          <>
            <UploadCloud className="h-7 w-7 text-muted-foreground" />
            <div className="text-sm font-medium text-muted-foreground">Click to select or drag &amp; drop</div>
            <div className="text-xs text-muted-foreground">.xlsx only</div>
          </>
        )}
      </div>

      {/* preview */}
      {preview && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Inferred period</span>
            <span className="font-mono text-foreground">{preview.period_date ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Rows to stage</span>
            <span className="font-mono text-foreground">{preview.rowsToStage.toLocaleString()}</span>
          </div>
          {preview.issues.map((iss, i) => (
            <div key={i} className={cn('flex items-start gap-1.5 text-xs', iss.level === 'error' ? 'text-red-400' : 'text-amber-400')}>
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{iss.message}</span>
            </div>
          ))}
          {preview.ok && preview.issues.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Ready to stage.</div>
          )}
        </div>
      )}

      {/* re-stage (CONSO only) */}
      {kind === 'CONSO' && restageOptions.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Re-stage into existing batch (optional)</Label>
          <Select value={restageId} onValueChange={setRestageId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-sm">New batch</SelectItem>
              {restageOptions.map(b => <SelectItem key={b.id} value={b.id} className="text-sm">#{b.id} — {b.filename} ({b.status})</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Re-staging resets that batch’s staged rows &amp; approvals and reuses its ID.</p>
        </div>
      )}

      {/* rules */}
      <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/80">Rules</p>
        <p>• Filename like <code className="rounded bg-muted px-1">26Q3 Mar …</code> to infer the period.</p>
        <p>• <code className="rounded bg-muted px-1">Details - P1 …</code> sheets carry the per-plant actuals.</p>
        {kind === 'CONSO' && <p>• Required approvals: PIC-P1, PIC-P2, PIC-BK, Finance-PIC.</p>}
        {kind === 'CONSO' && <p>• Re-uploading an existing CONSO needs a version suffix (e.g. <code className="rounded bg-muted px-1">… v2</code>).</p>}
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button onClick={submit} disabled={!file || !preview?.ok} className="gap-1.5">
          <UploadCloud className="h-4 w-4" /> Upload &amp; stage
        </Button>
        <Button variant="outline" onClick={() => { setFile(null); setRestageId('none'); if (inputRef.current) inputRef.current.value = ''; }}>Clear</Button>
      </div>
    </div>
  );
}
