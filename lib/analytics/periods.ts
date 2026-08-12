/**
 * Pure date/period helpers shared by the analytics engine and its tests. Everything here is
 * timezone-agnostic: the app stores calendar dates as YYYY-MM-DD, so we never touch Date
 * object timezones except to read wall-clock hour-of-day from an ISO/`HH:MM` recording.
 */

export const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: string): boolean {
  return ISO_DAY_RE.test(value);
}

/** Returns `today` as YYYY-MM-DD in the local timezone (server-local). */
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses YYYY-MM-DD into a Date at local midnight. */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Returns `YYYY-MM-DD` in the local timezone (server side) for a given Date. */
export function dateToKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns the Monday of the week containing `day` as YYYY-MM-DD. */
export function weekStart(day: string): string {
  const date = dayToDate(day);
  const dow = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - dow);
  return todayKey(date);
}

/** Week key — the Monday of the week (YYYY-MM-DD). Stable and lexicographically ordered. */
export function weekKey(day: string): string {
  return weekStart(day);
}

/** Plus N days from a YYYY-MM-DD key (N may be negative). */
export function addDays(day: string, n: number): string {
  const date = dayToDate(day);
  date.setDate(date.getDate() + n);
  return todayKey(date);
}

/** Month key `YYYY-MM` from a day key. */
export function monthKey(day: string): string {
  return day.slice(0, 7);
}

/** First day of the month as YYYY-MM-DD. */
export function monthStart(month: string): string {
  return `${month}-01`;
}

/**
 * Wall-clock hour (0-23) from an ISO timestamp or "HH:MM[:SS]" string. Returns null when the
 * value cannot be parsed, so aggregators can skip malformed records rather than throw.
 */
export function hourOf(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const isoMatch = /T(\d{1,2}):(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const h = Number(isoMatch[1]);
    return h >= 0 && h <= 23 ? h : null;
  }
  const hhmm = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (hhmm) {
    const h = Number(hhmm[1]);
    return h >= 0 && h <= 23 ? h : null;
  }
  return null;
}

/** Index (0..6, Monday) of the weekday a YYYY-MM-DD falls on. */
export function weekdayIndex(day: string): number {
  return (dayToDate(day).getDay() + 6) % 7;
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}