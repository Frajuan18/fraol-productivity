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
