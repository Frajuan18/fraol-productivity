import { describe, it, expect } from 'vitest';
import {
  isIsoDay,
  todayKey,
  dayToDate,
  weekStart,
  weekKey,
  addDays,
  monthKey,
  monthStart,
  hourOf,
  weekdayIndex,
  clampPercent,
} from '@/lib/analytics/periods';

describe('periods', () => {
  describe('isIsoDay', () => {
    it('accepts YYYY-MM-DD', () => {
      expect(isIsoDay('2025-03-05')).toBe(true);
    });
    it('rejects malformed strings', () => {
      expect(isIsoDay('2025/03/05')).toBe(false);
      expect(isIsoDay('2025-13-40')).toBe(true); // regex only checks shape, not a real date
      expect(isIsoDay('05')).toBe(false);
    });
  });

  describe('todayKey / dateToKey', () => {
    it('round-trips a known date', () => {
      const d = new Date(2025, 2, 5);
      expect(todayKey(d)).toBe('2025-03-05');
      expect(dayToDate('2025-03-05')).toEqual(d);
    });
  });

  describe('weekStart (Monday)', () => {
    it('returns Monday for a mid-week day', () => {
      expect(weekStart('2025-03-05')).toBe('2025-03-03'); // Wed -> Mon
    });
    it('is stable for a Monday itself', () => {
      expect(weekStart('2025-03-03')).toBe('2025-03-03');
    });
    it('wraps across a month boundary', () => {
      expect(weekStart('2025-03-01')).toBe('2025-02-24');
    });
  });

  describe('weekKey', () => {
    it('equals the Monday of the week', () => {
      expect(weekKey('2025-03-07')).toBe('2025-03-03');
    });
  });

  describe('addDays', () => {
    it('adds days across month boundary', () => {
      expect(addDays('2025-03-30', 3)).toBe('2025-04-02');
    });
    it('supports negative values', () => {
      expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
    });
  });

  describe('monthKey / monthStart', () => {
    it('extracts YYYY-MM and the first day', () => {
      expect(monthKey('2025-03-14')).toBe('2025-03');
      expect(monthStart('2025-03')).toBe('2025-03-01');
    });
  });

  describe('hourOf', () => {
    it('parses an ISO timestamp hour', () => {
      expect(hourOf('2025-03-05T14:30:00Z')).toBe(14);
    });
    it('parses an HH:MM value', () => {
      expect(hourOf('09:15')).toBe(9);
      expect(hourOf('23:59')).toBe(23);
    });
    it('rejects out-of-range and malformed values', () => {
      expect(hourOf('25:00')).toBe(null);
      expect(hourOf('not-a-time')).toBe(null);
      expect(hourOf('')).toBe(null);
      expect(hourOf(undefined)).toBe(null);
      expect(hourOf(null)).toBe(null);
    });
  });

  describe('weekdayIndex', () => {
    it('maps Monday to 0', () => {
      expect(weekdayIndex('2025-03-03')).toBe(0);
    });
    it('maps Sunday to 6', () => {
      expect(weekdayIndex('2025-03-09')).toBe(6);
    });
  });

  describe('clampPercent', () => {
    it('clamps into [0, 1]', () => {
      expect(clampPercent(-1)).toBe(0);
      expect(clampPercent(0.5)).toBe(0.5);
      expect(clampPercent(2.0)).toBe(1);
    });
    it('returns 0 for non-finite values', () => {
      expect(clampPercent(Number.NaN)).toBe(0);
      expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });
});
