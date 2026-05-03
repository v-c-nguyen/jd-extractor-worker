/** Normalize Postgres DATE (or driver value) to `YYYY-MM-DD` or `""`. */
export function normalizeSqlDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return match?.[1] ?? "";
}

/** Long locale date in UTC (avoids off-by-one from timezone). */
export function formatDobForDisplay(isoDate: string): string {
  const s = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, mo, d] = s.split("-").map(Number);
  if (!y || !mo || !d) return "";
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: "UTC" }).format(dt);
}
