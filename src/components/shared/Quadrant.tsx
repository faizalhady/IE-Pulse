/**
 * Quadrant — one 4Q section in the editor body, laid out exactly like OLE's:
 * a numbered square, the quadrant heading in primary caps, the sub-line, then
 * the content. No card around the content by default — every quadrant's own
 * component (Pareto, improvement table, Paynter/tracker) already draws its own
 * chrome, and a second frame around it is the double border OLE never had.
 * Pass `card` for the ones that render a bare chart (Q1).
 *
 * Shared by the Cycle Time and VA/NVA 4Qs; the preview sheet uses FourQPreview.
 */

export function Quadrant({ n, title, sub, card = false, children }: {
  n: string; title: string; sub: string; card?: boolean; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
          {n}
        </span>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-primary">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
      {card
        ? <div className="rounded-xl border border-border bg-card p-6 shadow-sm">{children}</div>
        : children}
    </section>
  );
}
