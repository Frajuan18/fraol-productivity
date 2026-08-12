import { describe, it, expect } from 'vitest';
import {
  aggregateDay,
  rollupWeek,
  rollupMonth,
  groupByWeek,
  groupByMonth,
  isAnalyzableDay,
} from '@/lib/analytics/aggregate';
import { todayKey, addDays } from '@/lib/analytics/periods';
import type { DailyAnalyticsDoc, WeeklyAnalyticsDoc } from '@/lib/mongodb/types';

const DAY = '2025-03-05';

function daily(date: string, partial: Partial<DailyAnalyticsDoc> = {}): DailyAnalyticsDoc {
  return {
    _id: `u:${date}`,
    userId: 'u',
    date,
    focusMinutes: 0,
    sessionsCompleted: 0,
    sessionsMissed: 0,
    sessionsInProgress: 0,
    interruptions: 0,
    breaks: 0,
    avgSessionMinutes: 0,
    plansCompleted: 0,
    plansInProgress: 0,
    plansPending: 0,
    planCompletionRate: 0,
    categoryFocusMinutes: {},
    hourlyMinutes: new Array(24).fill(0),
    bestHour: null,
    sharedFocusMinutes: 0,
    computedAt: DAY,
    ...partial,
  };
}

function weekly(date: string, partial: Partial<WeeklyAnalyticsDoc> = {}): WeeklyAnalyticsDoc {
  return {
    _id: `u:${date}`,
    userId: 'u',
    weekStart: date,
    focusMinutes: 0,
    sessionsCompleted: 0,
    planCompletionRate: 0,
    dailyAverageMin: 0,
    bestDayIndex: null,
    hourlyMinutes: new Array(24).fill(0),
    topCategory: null,
    daysWithFocus: 0,
    computedAt: DAY,
    ...partial,
  };
}

describe('aggregateDay', () => {
  it('sums focus minutes and counts completed sessions', () => {
    const result = aggregateDay(
      [
        { date: DAY, durationMinutes: 25, status: 'Completed', startTime: '2025-03-05T09:00:00Z' },
        { date: DAY, durationMinutes: 15, status: 'Completed', startTime: '2025-03-05T10:00:00Z' },
      ],
      [],
    );
    expect(result.focusMinutes).toBe(40);
    expect(result.sessionsCompleted).toBe(2);
    expect(result.avgSessionMinutes).toBe(20);
  });

  it('detects a long gap as a break, not an interruption', () => {
    const result = aggregateDay(
      [
        { date: DAY, durationMinutes: 25, status: 'Completed', startTime: '2025-03-05T09:00:00Z' },
        { date: DAY, durationMinutes: 25, status: 'Completed', startTime: '2025-03-05T12:00:00Z' },
      ],
      [],
    );
    expect(result.breaks).toBe(1);
    expect(result.interruptions).toBe(0);
  });

  it('detects a short gap as an interruption', () => {
    const result = aggregateDay(
      [
        { date: DAY, durationMinutes: 25, status: 'Completed', startTime: '2025-03-05T09:00:00Z' },
        { date: DAY, durationMinutes: 25, status: 'Completed', startTime: '2025-03-05T09:40:00Z' },
      ],
      [],
    );
    expect(result.interruptions).toBe(1);
    expect(result.breaks).toBe(0);
  });

  it('buckets minutes into the hour of the recording', () => {
    const result = aggregateDay(
      [{ date: DAY, durationMinutes: 30, status: 'Completed', startTime: '2025-03-05T14:45:00Z' }],
      [],
    );
    expect(result.hourlyMinutes[14]).toBe(30);
    expect(result.bestHour).toBe(14);
  });

  it('ignores malformed start times without throwing', () => {
    const result = aggregateDay([{ date: DAY, durationMinutes: 20, status: 'Completed', startTime: 'nope' }], []);
    expect(result.focusMinutes).toBe(20);
    expect(result.bestHour).toBe(null);
  });

  it('counts plans by status and computes completion rate', () => {
    const result = aggregateDay(
      [],
      [
        { date: DAY, status: 'completed', category: 'Study' },
        { date: DAY, status: 'pending', category: 'Study' },
      ],
    );
    expect(result.plansCompleted).toBe(1);
    expect(result.plansPending).toBe(1);
    expect(result.planCompletionRate).toBe(0.5);
  });

  it('adds shared focus minutes on top of personal focus', () => {
    const result = aggregateDay(
      [{ date: DAY, durationMinutes: 10, status: 'Completed', startTime: '2025-03-05T09:00:00Z' }],
      [],
      45,
    );
    expect(result.sharedFocusMinutes).toBe(45);
  });

  it('leaves bestHour null when nothing was recorded', () => {
    const result = aggregateDay([], []);
    expect(result.bestHour).toBe(null);
    expect(result.focusMinutes).toBe(0);
  });
});

describe('rollupWeek', () => {
  it('computes totals and the best day by weekday', () => {
    const dailies = [
      daily('2025-03-03', {
        focusMinutes: 30,
        sessionsCompleted: 1,
        hourlyMinutes: Array(24)
          .fill(0)
          .map((_, h) => (h === 9 ? 30 : 0)),
      }),
      daily('2025-03-04', {
        focusMinutes: 60,
        sessionsCompleted: 2,
        hourlyMinutes: Array(24)
          .fill(0)
          .map((_, h) => (h === 10 ? 60 : 0)),
      }),
    ];
    const week = rollupWeek(dailies);
    expect(week.weekStart).toBe('2025-03-03');
    expect(week.focusMinutes).toBe(90);
    expect(week.sessionsCompleted).toBe(3);
    expect(week.bestDayIndex).toBe(1); // Tuesday
    expect(week.daysWithFocus).toBe(2);
    expect(week.dailyAverageMin).toBe(45);
    expect(week.hourlyMinutes[10]).toBe(60);
  });

  it('returns null bestDay when there is no focus', () => {
    const week = rollupWeek([daily('2025-03-03'), daily('2025-03-04')]);
    expect(week.bestDayIndex).toBe(null);
    expect(week.daysWithFocus).toBe(0);
  });
});

describe('rollupMonth', () => {
  it('rolls weeks up and finds preferred hours', () => {
    const hours = Array(24).fill(0);
    hours[20] = 45;
    const weeks = [
      weekly('2025-03-03', { focusMinutes: 45, hourlyMinutes: hours, bestDayIndex: 1 }),
      weekly('2025-03-10', { focusMinutes: 45, hourlyMinutes: hours, bestDayIndex: 1 }),
    ];
    const month = rollupMonth(weeks);
    expect(month.month).toBe('2025-03');
    expect(month.focusMinutes).toBe(90);
    expect(month.weekCount).toBe(2);
    expect(month.weeklyAverageMin).toBe(45);
    expect(month.preferredHours).toEqual([20]);
    expect(month.bestWeekdayIndex).toBe(1);
    expect(month.trend).toEqual([45, 45]);
  });
});

describe('groupByWeek / groupByMonth', () => {
  it('groups days into Monday-started weeks', () => {
    const groups = groupByWeek([daily('2025-03-03'), daily('2025-03-05'), daily('2025-03-10')]);
    expect([...groups.keys()]).toEqual(['2025-03-03', '2025-03-10']);
    expect(groups.get('2025-03-03')?.length).toBe(2);
  });

  it('groups days into months', () => {
    const groups = groupByMonth([daily('2025-03-31'), daily('2025-04-01')]);
    expect([...groups.keys()]).toEqual(['2025-03', '2025-04']);
  });
});

describe('isAnalyzableDay', () => {
  it('accepts today and rejects far past / future dates', () => {
    const today = todayKey();
    expect(isAnalyzableDay(today)).toBe(true);
    expect(isAnalyzableDay(addDays(today, 1))).toBe(true);
    expect(isAnalyzableDay(addDays(today, -500))).toBe(false);
    expect(isAnalyzableDay('nope')).toBe(false);
  });
});
