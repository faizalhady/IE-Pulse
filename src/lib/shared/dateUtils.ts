/**
 * dateUtils.ts
 * ────────────
 * Generic date helpers shared across all apps.
 * Not OLE-specific — any future app may import from here.
 */

/** Local calendar day → "YYYY-MM-DD" (avoids UTC off-by-one). */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" → Date (local time). Returns undefined for invalid input. */
export function fromYmd(s: string): Date | undefined {
  if (!s?.trim()) return undefined;
  const parts = s.trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return undefined;
  const [y, mo, d] = parts;
  return new Date(y, mo - 1, d);
}

/**
 * Display formatter for OLE tables.
 * Accepts ISO strings ("2026-03-01", "2026-03-01T00:00:00", etc.) → "dd-mm-yyyy".
 * Returns "—" for null/undefined.
 */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const datePart = value.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length !== 3) return value;
  const [yyyy, mm, dd] = parts;
  return `${dd}-${mm}-${yyyy}`;
}
