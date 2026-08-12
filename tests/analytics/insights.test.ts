import { describe, it, expect } from 'vitest';
import { runGenerators, INSIGHT_GENERATORS } from '@/lib/analytics/insights';
import { todayKey, addDays } from '@/lib/analytics/periods';
import type { DailyAnalyticsDoc, WeeklyAnalyticsDoc, MonthlyAnalyticsDoc } from '@/lib/mongodb/types';
import type { InsightContext } from '@/lib/analytics/types';

function dailiesForStreak(count: number): DailyAnalyticsDoc[] {
  const today = todayKey();
  const out: DailyAnalyticsDoc[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = addDays(today, -i);
    out.push({
      _id: `u:${date}`,
      userId: 'u',
      date,
      focusMinutes: 20,
      sessionsCompleted: 1,
      sessionsMissed: 0,
      sessionsInProgress: 0,
      interruptions: 0,
      breaks: 0,
      avgSessionMinutes: 20,
      plansCompleted: 0,
      plansInProgress: 0,
      plansPending: 0,
      planCompletionRate: 0,
      categoryFocusMinutes: {},
      hourlyMinutes: Array(24).fill(0),
      bestHour: 9,
      sharedFocusMinutes: 0,
      computedAt: date,
    });
  }
  return out;
}

function weeklies(focusMinutes = 120, bestDayIndex: number | null = 1): WeeklyAnalyticsDoc[] {
  const hours = Array(24).fill(0);
  hours[9] = 60;
  hours[10] = 60;
  return [1, 2].map((i) => ({
    _id: `u:2025-03-0${i}`,
    userId: 'u',
    weekStart: `2025-03-0${i}`,
    focusMinutes,
    sessionsCompleted: 4,
    planCompletionRate: 0.8,
    dailyAverageMin: 40,
    bestDayIndex,
    hourlyMinutes: hours,
    topCategory: 'Study',
    daysWithFocus: 5,
    computedAt: `2025-03-0${i}`,
  }));
}

function monthlies(): MonthlyAnalyticsDoc[] {
  const months = ['2025-01', '2025-02', '2025-03'];
  return months.map((month, i) => ({
    _id: `u:${month}`,
    userId: 'u',
    month,
    focusMinutes: 300 * (i + 1),
    sessionsCompleted: 12,
    planCompletionRate: 0.7,
    weeklyAverageMin: 90,
    preferredHours: [9],
    bestWeekdayIndex: 1,
    topCategory: 'Study',
    weekCount: 4,
    trend: [300, 300, 300],
    computedAt: month,
  }));
}

function context(partial: Partial<InsightContext> = {}): InsightContext {
  return {
    userId: 'u',
    sampleDays: 0,
    sampleWeeks: 0,
    sampleMonths: 0,
    todayFocusMinutes: 0,
    dailies: [],
    weeklies: [],
    monthlies: [],
    ...partial,
  };
}

describe('runGenerators', () => {
  it('registers all generators', () => {
    expect(INSIGHT_GENERATORS.map((g) => g.id)).toEqual([
      'preferred-hours',
      'best-day',
      'focus-trend',
      'plan-completion',
      'focus-streak',
      'interruptions',
    ]);
  });

  it('returns nothing when there is no history', () => {
    expect(runGenerators(context())).toEqual([]);
  });

  it('never throws when a generator misbehaves', () => {
    const result = runGenerators(
      context({
        weeklies: weeklies(),
        monthlies: monthlies(),
        dailies: dailiesForStreak(5),
      }),
    );
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('preferred-hours', () => {
  it('identifies a 2-hour peak window from weekly hours', () => {
    const insights = runGenerators(context({ weeklies: weeklies(120) }));
    const found = insights.find((i) => i.id === 'preferred-hours');
    expect(found).toBeTruthy();
    expect(found?.message).toContain('09:00');
    expect(found?.message).toContain('11:00');
    expect(found?.severity).toBe('positive');
  });

  it('returns null with fewer than 2 weeks', () => {
    const insights = runGenerators(context({ weeklies: [weeklies(120)[0]] }));
    expect(insights.find((i) => i.id === 'preferred-hours')).toBeUndefined();
  });
});

describe('best-day', () => {
  it('reports the most frequent best weekday when consistent across weeks', () => {
    const insights = runGenerators(
      context({
        weeklies: [1, 2, 3].map((i) => ({
          _id: `u:${i}`,
          userId: 'u',
          weekStart: `2025-03-0${i}`,
          focusMinutes: 100,
          sessionsCompleted: 4,
          planCompletionRate: 0.5,
          dailyAverageMin: 25,
          bestDayIndex: 1,
          hourlyMinutes: Array(24).fill(0),
          topCategory: null,
          daysWithFocus: 3,
          computedAt: `2025-03-0${i}`,
        })),
      }),
    );
    const found = insights.find((i) => i.id === 'best-day');
    expect(found?.message).toContain('Tue');
  });
});

describe('focus-trend', () => {
  it('flags a drop as attention', () => {
    const [a, b, c] = monthlies();
    const insights = runGenerators(context({ monthlies: [a, b, { ...c, focusMinutes: 300 }] }));
    const found = insights.find((i) => i.id === 'focus-trend');
    expect(found?.severity).toBe('attention');
    expect(found?.message).toContain('50%');
  });
});

describe('plan-completion', () => {
  it('emits positive when completion is high', () => {
    const dailies = ['2025-03-03', '2025-03-04', '2025-03-05'].map(
      (date, i) =>
        dailiesForStreak(1).map((d) => ({
          ...d,
          date,
          plansCompleted: 2,
          plansPending: i === 0 ? 1 : 0,
          plansInProgress: 0,
          planCompletionRate: i === 0 ? 2 / 3 : 1,
        }))[0],
    );
    const insights = runGenerators(context({ dailies }));
    const found = insights.find((i) => i.id === 'plan-completion');
    expect(found?.severity).toBe('positive');
  });

  it('returns null with too few analysed days', () => {
    const insights = runGenerators(context({ dailies: [] }));
    expect(insights.find((i) => i.id === 'plan-completion')).toBeUndefined();
  });
});

describe('focus-streak', () => {
  it('reports the current consecutive-day streak', () => {
    const insights = runGenerators(context({ dailies: dailiesForStreak(3) }));
    const found = insights.find((i) => i.id === 'focus-streak');
    expect(found?.severity).toBe('positive');
    expect(found?.message).toContain('3');
  });

  it('returns null for a broken streak', () => {
    const dailies = dailiesForStreak(1);
    dailies.push({ ...dailies[0], date: addDays(dailies[0].date, -2) });
    const insights = runGenerators(context({ dailies }));
    expect(insights.find((i) => i.id === 'focus-streak')).toBeUndefined();
  });
});

describe('interruptions', () => {
  it('reports interruption ratio when frequent', () => {
    const dailies = ['2025-03-03', '2025-03-04', '2025-03-05', '2025-03-06'].map((date) => ({
      ...dailiesForStreak(1)[0],
      date,
      sessionsCompleted: 2,
      interruptions: 3,
      focusMinutes: 60,
    }));
    const insights = runGenerators(context({ dailies }));
    const found = insights.find((i) => i.id === 'interruptions');
    expect(found?.severity).toBe('attention');
    expect(found?.message).toContain('1.5');
  });
});
