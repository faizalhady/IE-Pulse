import { useState } from 'react';
import { FileText, Download, ExternalLink, Search, ChevronRight, BookOpen, Wrench, ClipboardList, File } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type DocCategory = 'all' | 'sop' | 'training' | 'maintenance' | 'reports';

const DOCS = [
  { id: 1,  title: 'SMT Line Setup Procedure',              category: 'sop',         type: 'PDF',  size: '2.4 MB',  updated: '12 Mar 2026', bay: 'All Bays',      description: 'Standard operating procedure for SMT line initialization and first article setup.' },
  { id: 2,  title: 'AOI Inspection Criteria v3.2',           category: 'sop',         type: 'PDF',  size: '1.8 MB',  updated: '08 Mar 2026', bay: 'Bay 211, 212',  description: 'Defect classification and acceptance criteria for AOI top and bottom inspection.' },
  { id: 3,  title: 'DR4 400G Machine Manual',                category: 'maintenance', type: 'PDF',  size: '15.2 MB', updated: '01 Feb 2026', bay: 'All Bays',      description: 'Full operator and maintenance manual for the DR4 400G pick and place system.' },
  { id: 4,  title: 'Feeder Jam Troubleshooting Guide',       category: 'maintenance', type: 'PDF',  size: '890 KB',  updated: '20 Feb 2026', bay: 'All Bays',      description: 'Step-by-step guide to diagnosing and resolving feeder jam incidents.' },
  { id: 5,  title: 'New Operator Onboarding — SMT',          category: 'training',    type: 'PPTX', size: '8.1 MB',  updated: '15 Jan 2026', bay: 'All Bays',      description: 'Training deck for new SMT line operators covering safety, setup, and quality standards.' },
  { id: 6,  title: 'GARDENA Product Checklist',              category: 'sop',         type: 'XLSX', size: '340 KB',  updated: '10 Mar 2026', bay: 'Bay 211',       description: 'Per-model quality checklist for GARDENA family products on Bay 211 lines.' },
  { id: 7,  title: 'Shift Handover Template',                category: 'sop',         type: 'DOCX', size: '120 KB',  updated: '05 Mar 2026', bay: 'All Bays',      description: 'Standardized shift handover form for operators and supervisors.' },
  { id: 8,  title: 'MARIN Line Change Procedure',            category: 'sop',         type: 'PDF',  size: '1.1 MB',  updated: '28 Feb 2026', bay: 'Bay 212',       description: 'Changeover SOP for MARIN product family including PCB and program change steps.' },
  { id: 9,  title: 'Preventive Maintenance Schedule Q2 2026', category: 'maintenance', type: 'XLSX', size: '210 KB',  updated: '01 Mar 2026', bay: 'All Bays',      description: 'Quarterly PM schedule for all SMT machines across all bays.' },
  { id: 10, title: 'ESD Handling Training',                  category: 'training',    type: 'PPTX', size: '4.5 MB',  updated: '10 Jan 2026', bay: 'All Bays',      description: 'Electrostatic discharge awareness and handling procedures for SMT components.' },
  { id: 11, title: 'Weekly Production Report Template',      category: 'reports',     type: 'XLSX', size: '280 KB',  updated: '03 Mar 2026', bay: 'All Bays',      description: 'Template for weekly production output reporting to management.' },
  { id: 12, title: 'WOODPECKER Firmware Update Guide',       category: 'maintenance', type: 'PDF',  size: '560 KB',  updated: '22 Feb 2026', bay: 'Bay 215',       description: 'Procedure for updating firmware on Bay 215 machines for WOODPECKER product line.' },
];

const CATEGORIES: { key: DocCategory; label: string; icon: any }[] = [
  { key: 'all',         label: 'All',        icon: FileText },
  { key: 'sop',         label: 'SOPs',        icon: ClipboardList },
  { key: 'training',    label: 'Training',    icon: BookOpen },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'reports',     label: 'Reports',     icon: File },
];

const TYPE_COLOR: Record<string, string> = {
  PDF:  'bg-red-500/15 text-red-400 border-red-500/30',
  PPTX: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  XLSX: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DOCX: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export default function Documents() {
  const [category, setCategory] = useState<DocCategory>('all');
  const [search, setSearch] = useState('');

  const filtered = DOCS.filter(d => {
    const matchCat = category === 'all' || d.category === category;
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.bay.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-0">
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6">
        <div className="pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Documents & SOPs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Standard operating procedures, training materials, and reference documents</p>
        </div>
      </div>

      {/* Filters — in body */}
      <div className="px-6 pt-4 pb-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…" className="pl-8 h-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setCategory(key)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                category === key ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
              )}
            ><Icon className="w-3 h-3" />{label}</button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} documents</span>
      </div>

      <div className="px-6 pb-8">
        <div className="rounded-xl border border-border overflow-hidden bg-card">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No documents found</div>
        ) : filtered.map(doc => (
          <div key={doc.id} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-muted/40 transition-colors group cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{doc.title}</p>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', TYPE_COLOR[doc.type] ?? 'bg-muted text-muted-foreground border-border')}>
                  {doc.type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.description}</p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-0.5 text-xs text-muted-foreground flex-shrink-0">
              <span>{doc.bay}</span>
              <span>{doc.size}</span>
            </div>
            <div className="hidden md:block text-xs text-muted-foreground flex-shrink-0 w-24 text-right">{doc.updated}</div>
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Download className="w-3.5 h-3.5" /></button>
              <button className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><ExternalLink className="w-3.5 h-3.5" /></button>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
