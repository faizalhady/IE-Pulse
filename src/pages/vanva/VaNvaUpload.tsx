/**
 * VaNvaUpload.tsx
 * ────────────────
 * Upload a new KPI Tracker workbook. Gated on useAccessLevel — a viewer sees
 * the dataset history read-only, an admin or above gets the drop-zone.
 *
 * ⚠️ The gate is a UI convenience, NOT a security boundary. The backend runs as
 * LocalSystem and never sees an authenticated caller, so the real check has to
 * live on the ingest endpoint when it is built. See hooks/useAccessLevel.ts.
 *
 * Ingestion is deliberately not implemented: the sheet shape, the period key
 * and the storage target are still open. This page validates the file and
 * registers it; useVaNvaUpload is the single place to point at a real
 * POST /api/va-nva/upload once that is decided.
 *
 * Route: /va-nva/upload
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccessLevel } from '@/hooks/useAccessLevel';
import { useVaNvaDatasets, useVaNvaUpload } from '@/hooks/va_nva/useVaNvaData';
import { cn } from '@/lib/utils';
import { PanelCard } from '@/pages/vanva/VaNvaChartKit';
import {
  AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Lock, ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

const MAX_BYTES = 15 * 1024 * 1024;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

type Issue = { level: 'error' | 'warning'; message: string };

/** Validate at the boundary — the file is user input and the only thing we can
 *  check before an ingest contract exists. */
function validate(file: File): { issues: Issue[]; ok: boolean; periodGuess: string } {
  const issues: Issue[] = [];
  const name = file.name.toLowerCase();

  if (!name.endsWith('.xlsx')) issues.push({ level: 'error', message: 'Only .xlsx is accepted — .xls and .csv will not parse.' });
  if (file.size === 0) issues.push({ level: 'error', message: 'File is empty.' });
  if (file.size > MAX_BYTES) issues.push({ level: 'error', message: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 15 MB.` });
  if (!/va\s*nva|vanva/.test(name)) {
    issues.push({ level: 'warning', message: 'Filename does not mention "VA NVA" — check this is the KPI tracker and not another workbook.' });
  }

  // Period from the filename, e.g. "… Aug 2026 …" / "… 2026-08 …".
  const now = new Date();
  const m = name.match(/(20\d{2})[-_ ]?(0[1-9]|1[0-2])/);
  const mon = MONTHS.findIndex(x => name.includes(x));
  const periodGuess = m
    ? `${m[1]}-${m[2]}`
    : mon >= 0
      ? `${now.getFullYear()}-${String(mon + 1).padStart(2, '0')}`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return { issues, ok: !issues.some(i => i.level === 'error'), periodGuess };
}

export default function VaNvaUpload() {
  const access = useAccessLevel();
  const { data: datasets = [] } = useVaNvaDatasets();
  const upload = useVaNvaUpload();

  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const check = useMemo(() => (file ? validate(file) : null), [file]);
  const canUpload = access.isAdmin || access.isDeveloper;

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    setFile(f);
    const v = validate(f);
    if (!period) setPeriod(v.periodGuess);
  };

  const submit = () => {
    if (!file || !check?.ok) return;
    upload.mutate(
      { file, periodLabel: period || check.periodGuess, uploadedBy: access.ntid ?? 'unknown' },
      {
        onSuccess: () => {
          toast.success(`${file.name} accepted. Parsing is not wired yet — the dashboard still reads the seeded dataset.`);
          setFile(null);
          if (inputRef.current) inputRef.current.value = '';
        },
        onError: () => toast.error('Upload failed.'),
      },
    );
  };

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
        <h1 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <UploadCloud className="h-4 w-4 text-teal-500" /> Upload KPI Tracker
        </h1>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {access.loading
            ? 'Checking your access…'
            : canUpload
              ? <>Signed in as <span className="font-mono">{access.ntid ?? '—'}</span> · {access.level}</>
              : <>Read-only — uploading needs admin. Signed in as <span className="font-mono">{access.ntid ?? '—'}</span>.</>}
        </p>
      </div>

      <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* ─── Upload ─────────────────────────────────────────────────── */}
        <PanelCard
          title="New workbook"
          hint="Sheet1 = per-workcell VA/NVA rows, Sheet2 = maturity targets."
          actions={
            <span className={cn('flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border',
              canUpload ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-muted text-muted-foreground border-border')}>
              {canUpload ? <ShieldCheck className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {canUpload ? 'Allowed' : 'Admin only'}
            </span>
          }
        >
          <div className="p-4 space-y-4">
            {access.loading ? (
              <div className="h-40 rounded-xl bg-muted/40 animate-pulse" />
            ) : !canUpload ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
                <Lock className="h-7 w-7 text-muted-foreground mx-auto" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">Uploading needs admin access</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask an IE Pulse admin to grant it, or send the workbook to them to upload.
                </p>
              </div>
            ) : (
              <>
                <div
                  onClick={() => inputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={e => { e.preventDefault(); setDragging(false); }}
                  onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
                  className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
                    dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-muted/20')}
                >
                  <input ref={inputRef} type="file" accept=".xlsx" className="sr-only"
                    onChange={e => pick(e.target.files?.[0])} />
                  {file ? (
                    <>
                      <FileSpreadsheet className="h-7 w-7 text-primary" />
                      <p className="text-sm font-medium text-foreground break-all">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-7 w-7 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Click to select or drag &amp; drop</p>
                      <p className="text-xs text-muted-foreground">.xlsx only · max 15 MB</p>
                    </>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Period</Label>
                  <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="2026-08" className="h-9" />
                  <p className="text-[10px] text-muted-foreground">Guessed from the filename — correct it if wrong.</p>
                </div>

                {check && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                    {check.issues.map((iss, i) => (
                      <p key={i} className={cn('flex items-start gap-1.5 text-xs',
                        iss.level === 'error' ? 'text-red-400' : 'text-amber-400')}>
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />{iss.message}
                      </p>
                    ))}
                    {check.ok && check.issues.length === 0 && (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Looks like a valid workbook.
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-amber-400">Parsing is not wired yet</p>
                  <p className="text-[10px] text-amber-200/80 leading-snug mt-0.5">
                    How the sheet is ingested and what the output report looks like are still open. This page
                    validates and registers the file; the dashboard keeps reading the seeded dataset until the
                    ingest endpoint exists.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={submit} disabled={!file || !check?.ok || upload.isPending} className="gap-1.5">
                    {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    Upload
                  </Button>
                  <Button variant="outline" onClick={() => { setFile(null); setPeriod(''); if (inputRef.current) inputRef.current.value = ''; }}>
                    Clear
                  </Button>
                </div>
              </>
            )}
          </div>
        </PanelCard>

        {/* ─── History ────────────────────────────────────────────────── */}
        <PanelCard title="Uploaded workbooks" hint="Newest first. The active one feeds the dashboard.">
          {datasets.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">Nothing uploaded yet.</p>
          ) : datasets.map((d, i) => (
            <div key={d.id} className={cn('px-4 py-3 flex items-center gap-3', i < datasets.length - 1 && 'border-b border-border')}>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground truncate">{d.filename}</p>
                <p className="text-[10px] text-muted-foreground">
                  {d.periodLabel} · {d.rowCount} rows · {d.uploadedBy} · {new Date(d.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              {d.active && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex-shrink-0">
                  Active
                </span>
              )}
            </div>
          ))}
        </PanelCard>
      </div>
    </div>
  );
}
