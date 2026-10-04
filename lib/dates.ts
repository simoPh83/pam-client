// Display formatting for Postgres `date` columns ("YYYY-MM-DD" strings).

/** "2026-09-30" → "30/09/2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** "2026-09-30" → "09/2026" (compact, for Decided column) */
export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m] = iso.slice(0, 10).split("-");
  if (!y || !m) return iso;
  return `${m}/${y}`;
}

/** timestamptz ISO → "30/09/2026 14:22" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const date = formatDate(iso.slice(0, 10));
  const time = iso.slice(11, 16);
  return `${date} ${time}`;
}
