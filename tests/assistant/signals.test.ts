import { describe, it, expect } from 'vitest';
import { computeHistorySignals, shortDateToIso, isoWeekday, todayIso, hourOf } from '@/lib/assistant/signals';
import type { Session, Plan } from '@/src/types';

const NOW = new Date(2026, 0, 5, 12, 0, 0); // Monday 2026-01-05

function session(overrides: Partial<Session>): Session {
  return {
    id: 1,
    task: 'Read biology chapter 4',
    duration: '45m',
    date: 'Mon, Jan 5',
    status: 'Completed',
    ...overrides,
  };
}

function plan(overrides: Partial<Plan>): Plan {
  return {
    id: 1,
    title: 'Review biology',
    description: '',
    type: 'daily',
    status: 'not-started',
    date: todayIso(NOW),
    priority: 'medium',
    category: 'Study',
    ...overrides,
  };
}

describe('shortDateToIso', () => {
  it('parses the app short-date format into ISO', () => {
    expect(shortDateToIso('Mon, Jan 5', NOW)).toBe('2026-01-05');
    expect(shortDateToIso('Wed, Jan 21', NOW)).toBe('2026-01-21');
  });

  it('returns null for unparseable input', () => {
    expect(shortDateToIso('05/01/2026', NOW)).toBeNull();
    expect(shortDateToIso('', NOW)).toBeNull();
  });
});

describe('isoWeekday / todayIso / hourOf', () => {
  it('maps Monday to 0 and Sunday to 6', () => {
    expect(isoWeekday('2026-01-05')).toBe(0);
    expect(isoWeekday('2026-01-11')).toBe(6);
  });

  it('builds a local ISO date for today', () => {
    expect(todayIso(NOW)).toBe('2026-01-05');
  });

  it('parses 12h and 24h clock strings into an hour', () => {
    expect(hourOf('10:30 AM')).toBe(10);
    expect(hourOf('2:30 PM')).toBe(14);
    expect(hourOf('09:15')).toBe(9);
    expect(hourOf('12:00 AM')).toBe(0);
    expect(hourOf('12:00 PM')).toBe(12);
    expect(hourOf('bogus')).toBeNull();
    expect(hourOf(undefined)).toBeNull();
  });
});

describe('computeHistorySignals', () => {
  it('computes averages and median session length from history', () => {
    const sessions = [
      session({ duration: '30m' }),
      session({ duration: '45m' }),
      session({ duration: '1h 15m', date: 'Tue, Jan 6' }),
      session({ id: 2, task: 'Work report', duration: '2h 30m', date: 'Wed, Jan 7', status: 'Completed' }),
    ];
    const signals = computeHistorySignals(sessions, [], NOW);
    expect(signals.avgSessionMinutes).toBe(75); // (30+45+75+150)/4
    expect(signals.medianSessionMinutes).toBe(60); // (45+75)/2
    expect(signals.dailyCapacityMinutes).toBe(100); // daily totals [75,75,150]
    expect(signals.weeklyCapacityMinutes).toBe(500);
  });

  it('finds the best focus hour from start times', () => {
    const sessions = [
      session({ startTime: '9:00 AM', duration: '1h' }),
      session({ startTime: '9:30 AM', duration: '1h' }),
      session({ startTime: '3:00 PM', duration: '30m' }),
    ];
    expect(computeHistorySignals(sessions, [], NOW).bestHour).toBe(9);
  });

  it('finds the best focus weekday', () => {
    const sessions = [
      session({ duration: '1h', date: 'Mon, Jan 5' }),
      session({ duration: '1h', date: 'Mon, Jan 12' }),
      session({ duration: '30m', date: 'Tue, Jan 6' }),
    ];
    expect(computeHistorySignals(sessions, [], NOW).bestWeekday).toBe(0); // Monday
  });

  it('computes plan completion rate and overdue ratio', () => {
    const plans = [
      plan({ status: 'completed', date: '2025-12-20' }),
      plan({ status: 'completed', date: '2026-01-02' }),
      plan({ status: 'pending', date: '2026-01-06' }),
      plan({ id: 4, title: 'Overdue', status: 'in-progress', date: '2025-12-30' }),
    ];
    const signals = computeHistorySignals([], plans, NOW);
    expect(signals.planCompletionRate).toBe(0.5);
    expect(signals.overdueRatio).toBe(0.5); // 1 of 2 open plans is overdue
    expect(signals.openPlans).toHaveLength(2);
  });

  it('detects overloaded days from open plan load', () => {
    const plans = [
      plan({ status: 'pending', date: todayIso(NOW), type: 'daily', priority: 'high' }),
      plan({ id: 2, title: 'Second', status: 'pending', date: todayIso(NOW), type: 'weekly', priority: 'high' }),
    ];
    // daily high = 39, weekly high = 117 => 156 total > 90 threshold (capacity 60 * 1.5)
    const signals = computeHistorySignals([session({ duration: '60m' })], plans, NOW);
    expect(signals.overloadDays.find((d) => d.date === todayIso(NOW))).toBeDefined();
  });

  it('aggregates per-category session statistics', () => {
    const sessions = [
      session({ task: 'Read biology chapter 4', duration: '30m' }),
      session({ id: 2, task: 'Exam review flashcards', duration: '1h' }),
      session({ id: 3, task: 'Client proposal draft', duration: '2h', status: 'Completed' }),
    ];
    const signals = computeHistorySignals(sessions, [], NOW);
    expect(signals.categoryStats['study']?.sessionCount).toBe(2);
    expect(signals.categoryStats['study']?.avgSessionMinutes).toBe(45);
    expect(signals.categoryStats['work']?.sessionCount).toBe(2);
    expect(signals.categoryStats['work']?.avgSessionMinutes).toBe(90);
  });
});
