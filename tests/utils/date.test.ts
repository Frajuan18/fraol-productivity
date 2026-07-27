import { describe, it, expect } from 'vitest';
import {
  formatShortDate,
  formatLongDate,
  formatClockTime,
  toIsoDateString,
  isSameDay,
  getWeekStart,
  getPreviousWeekStart,
  getMonthGrid,
  getMonthName,
} from '@/src/utils/date';

describe('formatShortDate', () => {
  it('formats a date as "Mon, Jan 1"', () => {
    const date = new Date(2025, 0, 1);
    expect(formatShortDate(date)).toBe('Wed, Jan 1');
  });
});

describe('formatLongDate', () => {
  it('formats a date as "Monday, January 1"', () => {
    const date = new Date(2025, 0, 1);
    expect(formatLongDate(date)).toBe('Wednesday, January 1');
  });
});

describe('formatClockTime', () => {
  it('includes hour and minute', () => {
    const date = new Date(2025, 0, 1, 10, 30);
    const result = formatClockTime(date);
    expect(result).toContain('10');
    expect(result).toContain('30');
  });
});

describe('toIsoDateString', () => {
  it('returns YYYY-MM-DD', () => {
    const date = new Date(Date.UTC(2025, 0, 1, 12, 0, 0));
    expect(toIsoDateString(date)).toBe('2025-01-01');
  });
});

describe('isSameDay', () => {
  it('returns true for same day', () => {
    const a = new Date(2025, 0, 1, 10, 0);
    const b = new Date(2025, 0, 1, 22, 0);
    expect(isSameDay(a, b)).toBe(true);
  });

  it('returns false for different days', () => {
    const a = new Date(2025, 0, 1);
    const b = new Date(2025, 0, 2);
    expect(isSameDay(a, b)).toBe(false);
  });
});

describe('getWeekStart', () => {
  it('returns Monday of the current week', () => {
    const date = new Date(2025, 0, 15);
    const start = getWeekStart(date);
    expect(start.getDay()).toBe(1);
    expect(start.getHours()).toBe(0);
  });
});

describe('getPreviousWeekStart', () => {
  it('returns Monday of the previous week', () => {
    const date = new Date(2025, 0, 15);
    const prev = getPreviousWeekStart(date);
    const currentMonday = getWeekStart(date);
    expect(prev.getTime()).toBe(currentMonday.getTime() - 7 * 86400000);
  });
});

describe('getMonthGrid', () => {
  it('returns correct days in January 2025', () => {
    const date = new Date(2025, 0, 15);
    const grid = getMonthGrid(date);
    expect(grid.daysInMonth).toBe(31);
  });

  it('returns correct first day of month', () => {
    const date = new Date(2025, 0, 15);
    const grid = getMonthGrid(date);
    expect(grid.firstDayOfMonth).toBe(3);
  });
});

describe('getMonthName', () => {
  it('returns "January" for January', () => {
    expect(getMonthName(new Date(2025, 0, 1))).toBe('January');
  });
});
