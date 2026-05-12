/**
 * Pagination.tsx
 * ──────────────
 * Generic page-control strip: shows "1–100 of 1,234" on the left and
 * « ‹ N / Total › » navigation buttons on the right.
 * Renders nothing when there's only one page.
 */

type Props = {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
};

export function Pagination({ page, total, pageSize, onChange }: Props) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <span className="text-xs text-muted-foreground">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(1)}
          disabled={page === 1}
          className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >«</button>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >‹</button>
        <span className="px-3 py-1 text-xs font-mono text-foreground">{page} / {pages}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === pages}
          className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >›</button>
        <button
          onClick={() => onChange(pages)}
          disabled={page === pages}
          className="px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >»</button>
      </div>
    </div>
  );
}
