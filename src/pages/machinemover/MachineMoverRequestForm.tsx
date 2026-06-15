/**
 * MachineMoverRequestForm.tsx — body of the "New move request" modal.
 * Text fields + dropdowns + a date/time booking + an upload drop-zone. Collects
 * a NewJobInput and hands it to the parent, which creates the job (Created
 * state, both PICs pending) and fires the mock approval-email toast.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DEPARTMENTS, DOORS, LOCATIONS, LOGISTICS,
} from '@/lib/machine_mover/machineMoverConstants';
import { MOCK_CURRENT_USER, type JobAttachment } from '@/pages/machinemover/mockMachineMoverData';
import type { NewJobInput } from '@/hooks/machine_mover/useMoveJobs';
import { cn } from '@/lib/utils';
import { DoorOpen, FileText, LogOut, UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs text-muted-foreground">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Picker({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((o) => <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function MachineMoverRequestForm({ onSubmit, onClose }: {
  onSubmit: (input: NewJobInput) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [machines, setMachines] = useState('');
  const [department, setDepartment] = useState('');
  const [pic, setPic] = useState(MOCK_CURRENT_USER.name);
  const [fromLocation, setFrom] = useState('');
  const [toLocation, setTo] = useState('');
  const [exitDoor, setExitDoor] = useState('');
  const [entranceDoor, setEntranceDoor] = useState('');
  const [date, setDate] = useState('');
  const [timeStart, setTimeStart] = useState('08:00');
  const [timeEnd, setTimeEnd] = useState('17:00');
  const [logistics, setLogistics] = useState('');
  const [reservation, setReservation] = useState('');
  const [files, setFiles] = useState<JobAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null | undefined) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list).map((f) => ({ name: f.name, size: f.size }))]);
  };

  const machineList = machines.split(/[\n,]+/).map((m) => m.trim()).filter(Boolean);
  const valid = title.trim() && machineList.length > 0 && department && pic.trim()
    && fromLocation && toLocation && exitDoor && entranceDoor && date;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      title: title.trim(),
      machines: machineList,
      department, pic: pic.trim(),
      fromLocation, toLocation, exitDoor, entranceDoor,
      date, timeStart, timeEnd,
      logistics: logistics || 'Internal team',
      reservation: reservation.trim() || '—',
      attachments: files,
    });
  };

  return (
    <div className="space-y-5">
      <Field label="Request title" required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Relocate SMT Reflow Oven" className="h-9" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Department" required>
          <Picker value={department} onChange={setDepartment} options={DEPARTMENTS} placeholder="Select department" />
        </Field>
        <Field label="PIC (requester)" required>
          <Input value={pic} onChange={(e) => setPic(e.target.value)} placeholder="Person in charge" className="h-9" />
        </Field>
      </div>

      <Field label="Machine(s)" required>
        <Textarea value={machines} onChange={(e) => setMachines(e.target.value)} rows={2}
          placeholder="One per line, or comma-separated — e.g. Reflow Oven #3 (RO-003)" className="text-sm resize-none" />
      </Field>

      {/* Route — point A → point B */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="From (point A)" required>
          <Picker value={fromLocation} onChange={setFrom} options={LOCATIONS} placeholder="Origin" />
        </Field>
        <Field label="To (point B)" required>
          <Picker value={toLocation} onChange={setTo} options={LOCATIONS} placeholder="Destination" />
        </Field>
      </div>

      {/* Doors — exit from origin, enter at destination */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Exit door (from origin)" required>
          <div className="relative">
            <LogOut className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
            <div className="[&_button]:pl-8"><Picker value={exitDoor} onChange={setExitDoor} options={DOORS} placeholder="Exit door" /></div>
          </div>
        </Field>
        <Field label="Entrance door (at destination)" required>
          <div className="relative">
            <DoorOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
            <div className="[&_button]:pl-8"><Picker value={entranceDoor} onChange={setEntranceDoor} options={DOORS} placeholder="Entrance door" /></div>
          </div>
        </Field>
      </div>

      {/* Booking — date + time window */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Move date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
        </Field>
        <Field label="Start">
          <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="h-9" />
        </Field>
        <Field label="End">
          <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="h-9" />
        </Field>
      </div>

      <Field label="Logistics">
        <Picker value={logistics} onChange={setLogistics} options={LOGISTICS} placeholder="How it moves (default: Internal team)" />
      </Field>

      <Field label="Reservation / notes">
        <Textarea value={reservation} onChange={(e) => setReservation(e.target.value)} rows={2}
          placeholder="e.g. 12 car parks reserve outside Chamber room shutter door" className="text-sm resize-none" />
      </Field>

      {/* Upload zone */}
      <Field label="Attachments">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={cn('flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors',
            dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-muted/20')}
        >
          <input ref={inputRef} type="file" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
          <UploadCloud className="h-6 w-6 text-muted-foreground" />
          <div className="text-xs font-medium text-muted-foreground">Click or drag &amp; drop drawings, permits, photos</div>
        </div>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate flex-1 text-foreground">{f.name}</span>
                <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                <button onClick={(e) => { e.stopPropagation(); setFiles((p) => p.filter((_, j) => j !== i)); }}
                  className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border mt-1 -mx-1 px-1">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={!valid} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
          Submit request
        </Button>
      </div>
    </div>
  );
}
