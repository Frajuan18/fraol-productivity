const DATE_LOCALE = 'en-US';

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(DATE_LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(DATE_LOCALE, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatClockTimeWithSeconds(date: Date): string {
  return date.toLocaleTimeString(DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function toIsoDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function getWeekStart(date: Date = new Date()): Date {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getPreviousWeekStart(date: Date = new Date()): Date {
  const start = getWeekStart(date);
  start.setDate(start.getDate() - 7);
  return start;
}

export function getMonthGrid(date: Date): { daysInMonth: number; firstDayOfMonth: number } {
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    daysInMonth: new Date(year, month + 1, 0).getDate(),
    firstDayOfMonth: new Date(year, month, 1).getDay(),
  };
}

export function getMonthName(date: Date): string {
  return date.toLocaleString('default', { month: 'long' });
}

const MONTH_ABBR: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const LOCALE_DATE_RE = /^[A-Z][a-z]{2},\s*([A-Z][a-z]{2})\s+(\d{1,2})$/;

/**
 * Safely parse a session date string. Handles both ISO ("2026-09-01") and
 * locale-format ("Tue, Sep 1") dates. Locale dates without a year are assigned
 * the current year (unlike `new Date("Tue, Sep 1")` which defaults to 2001).
 * Returns `null` for unparseable strings.
 */
export function parseSessionDate(dateStr: string, now = new Date()): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const match = LOCALE_DATE_RE.exec(trimmed);
  if (match) {
    const monthIdx = MONTH_ABBR[match[1]];
    if (monthIdx !== undefined) {
      return new Date(now.getFullYear(), monthIdx, Number(match[2]));
    }
  }

  return null;
}
