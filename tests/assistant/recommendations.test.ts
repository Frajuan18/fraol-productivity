import { describe, it, expect } from 'vitest';
import {
  buildRecommendations,
  estimateDuration,
  suggestDueDate,
  suggestFocusBlocks,
  suggestSchedule,
  suggestSplit,
  suggestMerge,
  suggestPriority,
  suggestRealism,
  formatMinutes,
} from '@/lib/assistant/recommendations';
import type { PlanDraft, HistorySignals } from '@/lib/assistant/types';

function signals(overrides: Partial<HistorySignals> = {}): HistorySignals {
  return {
    avgSessionMinutes: 45,
    medianSessionMinutes: 45,
    sessionsPerDay: 2,
    sessionsPerWeek: 8,
    dailyCapacityMinutes: 90,
    weeklyCapacityMinutes: 450,
    planCompletionRate: 0.8,
    categoryStats: {},
    bestHour: 9,
    bestWeekday: 0,
    overloadDays: [],
    openPlans: [],
    overdueRatio: 0,
    similarPlanCount: 0,
    ...overrides,
  };
}

const TODAY = '2026-01-05';

describe('estimateDuration', () => {
  it('uses per-category session averages when available', () => {
    const sig = signals({
      categoryStats: { exercise: { avgSessionMinutes: 60, sessionCount: 5, planCount: 2 } },
    });
    const result = estimateDuration({ title: 'Run', category: 'Exercise' }, sig);
    expect(result.minutes).toBe(60);
    expect(result.confidence).toBe('high');
  });

  it('falls back to the global average without category data', () => {
    const sig = signals({ avgSessionMinutes: 40, medianSessionMinutes: 40 });
    expect(estimateDuration({ title: 'Anything', category: 'Wonderful' }, sig).minutes).toBe(40);
  });

  it('returns a conservative default when there is no history', () => {
    const sig = signals({
      avgSessionMinutes: 0,
      medianSessionMinutes: 0,
      bestWeekday: null,
      bestHour: null,
    });
    const r = estimateDuration({ title: 'First plan' }, sig);
    expect(r.minutes).toBe(45);
    expect(r.confidence).toBe('low');
  });
});

describe('suggestFocusBlocks', () => {
  it('suggests a split into sessions when the estimate exceeds a single block', () => {
    const sig = signals({ avgSessionMinutes: 120, medianSessionMinutes: 30 });
    const rec = suggestFocusBlocks({ title: 'Big task' }, sig)!;
    expect(rec.kind).toBe('focus-block');
    expect(rec.canApply).toBe(false);
    expect(rec.apply.sessions).toBeGreaterThanOrEqual(1);
  });
});

describe('suggestDueDate', () => {
  it('moves away from an overloaded day', () => {
    const sig = signals({
      overloadDays: [{ date: TODAY, loadMinutes: 999 }],
      avgSessionMinutes: 40,
      medianSessionMinutes: 40,
    });
    const rec = suggestDueDate({ title: 'T', date: TODAY, priority: 'medium' }, sig)!;
    expect(rec.kind).toBe('overload');
    expect(rec.apply.date).not.toBe(TODAY);
    expect(rec.canApply).toBe(true);
  });

  it('returns null when the chosen day is not overloaded', () => {
    const sig = signals({ bestWeekday: 0, avgSessionMinutes: 40, medianSessionMinutes: 40 });
    expect(suggestDueDate({ title: 'T', date: TODAY, priority: 'medium' }, sig)).toBeNull();
  });
});

describe('suggestSchedule', () => {
  it('suggests a schedule derived from the best hour/weekday', () => {
    const rec = suggestSchedule({ title: 'T' }, signals({ bestHour: 9, bestWeekday: 0 }))!;
    expect(rec.id).toBe('schedule');
    expect(rec.canApply).toBe(true);
    expect(rec.apply.descriptionAppend).toContain('Monday');
  });

  it('returns null when there is no focus signal', () => {
    expect(suggestSchedule({ title: 'T' }, signals({ bestHour: null, bestWeekday: null }))).toBeNull();
  });
});

describe('suggestSplit', () => {
  it('suggests splitting when estimated scope exceeds weekly capacity', () => {
    const sig = signals({
      weeklyCapacityMinutes: 120,
      dailyCapacityMinutes: 40,
      avgSessionMinutes: 200,
      medianSessionMinutes: 200,
    });
    const rec = suggestSplit({ title: 'Huge task' }, sig)!;
    expect(rec.kind).toBe('split');
    expect(rec.canApply).toBe(false);
  });

  it('returns null for a normal scope', () => {
    expect(suggestSplit({ title: 'Small' }, signals({ weeklyCapacityMinutes: 500 }))).toBeNull();
  });
});

describe('suggestMerge', () => {
  it('suggests merging when several open plans are due the same day', () => {
    const sig = signals({
      openPlans: [
        { id: 1, title: 'A', date: TODAY, category: 'Study', priority: 'medium' },
        { id: 2, title: 'B', date: TODAY, category: 'Study', priority: 'medium' },
      ],
    });
    const rec = suggestMerge({ title: 'T', category: 'Study', date: TODAY }, sig)!;
    expect(rec.kind).toBe('merge');
  });
});

describe('suggestPriority', () => {
  it('suggests raising priority when category is backlogged', () => {
    const back = signals({
      openPlans: [
        { id: 1, title: 'A', date: '2025-12-01', category: 'Study', priority: 'medium' },
        { id: 2, title: 'B', date: '2025-12-02', category: 'Study', priority: 'medium' },
      ],
      overdueRatio: 1,
    });
    const rec = suggestPriority({ title: 'T', category: 'Study', priority: 'medium' }, back)!;
    expect(rec.kind).toBe('confidence');
    expect(rec.apply.priority).toBe('high');
  });

  it('skips when the user already set high priority', () => {
    expect(suggestPriority({ title: 'T', priority: 'high' }, signals({ overdueRatio: 1 }))).toBeNull();
  });
});

describe('suggestRealism', () => {
  it('nudges scope down when completion has been weak and plans overdue', () => {
    const rec = suggestRealism({ title: 'T' }, signals({ planCompletionRate: 0.3, overdueRatio: 0.5 }))!;
    expect(rec.kind).toBe('balance');
    expect(rec.canApply).toBe(false);
  });

  it('returns null for healthy completion', () => {
    expect(suggestRealism({ title: 'T' }, signals({ planCompletionRate: 0.8, overdueRatio: 0 }))).toBeNull();
  });
});

describe('buildRecommendations', () => {
  it('caps the number of recommendations and never mutates the draft', () => {
    const sig = signals({
      overloadDays: [{ date: TODAY, loadMinutes: 500 }],
      avgSessionMinutes: 60,
      medianSessionMinutes: 60,
      weeklyCapacityMinutes: 150,
      dailyCapacityMinutes: 30,
      planCompletionRate: 0.2,
      overdueRatio: 0.6,
      openPlans: [
        { id: 1, title: 'A', date: TODAY, category: 'Study', priority: 'medium' },
        { id: 2, title: 'B', date: TODAY, category: 'Study', priority: 'medium' },
      ],
    });
    const draft: PlanDraft = { title: 'Very big task', category: 'Study', priority: 'medium', date: TODAY };
    const draftSnapshot = { ...draft };
    const recs = buildRecommendations({ draft, signals: sig });
    expect(recs.length).toBeLessThanOrEqual(4);
    expect(draft).toEqual(draftSnapshot);
    expect(recs.every((r) => typeof r.id === 'string')).toBe(true);
  });

  it('returns an empty list when there are no actionable suggestions', () => {
    const quiet = signals({
      bestHour: null,
      bestWeekday: null,
      overloadDays: [],
      planCompletionRate: 0.9,
      overdueRatio: 0,
      openPlans: [],
    });
    const recs = buildRecommendations({ draft: { title: 'Small', priority: 'high', date: TODAY }, signals: quiet });
    expect(recs).toEqual([]);
  });
});

describe('formatMinutes', () => {
  it('formats minutes into compact strings', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(135)).toBe('2h 15m');
    expect(formatMinutes(60)).toBe('1h 0m');
  });
});
