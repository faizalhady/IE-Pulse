import { CalendarDays, Filter, RefreshCw } from 'lucide-react';

export default function eBuildPlan() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">eBuild Plan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Demand & output planning across workcells and assemblies
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">Date Range</label>
          <input
            type="date"
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">Workcell</label>
          <select className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
            <option value="">All</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground font-medium">Assembly</label>
          <select className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
            <option value="">All</option>
          </select>
        </div>
        <button className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          Apply Filters
        </button>
      </div>

      {/* Placeholder content */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-20 gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <CalendarDays className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">eBuild Plan — Coming Soon</p>
          <p className="text-xs text-muted-foreground mt-1">
            Select filters above to view upcoming demand and expected output.
          </p>
        </div>
      </div>
    </div>
  );
}
