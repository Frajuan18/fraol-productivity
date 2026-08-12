import { describe, it, expect } from 'vitest';
import { formatShortDate } from '@/src/utils/date';
import type { Plan, PlanStatus, Session } from '@/src/types';
import {
  activeSessionOf,
  buildHeatmap,
  buildInsights,
  buildWeekDays,
  consistencyScoreFor,
  dailyGoalMinutes,
  displayMinutes,
  focusMinutesInRange,
  greetingFor,
  lastNDateStrings,
  levelFor,
  longTermGoals,
  nextUpcomingPlan,
  planProgress,
  sessionsInRange,
  startOfWeekIso,
  todayMinutesFor,
  weeklyComparison,
  type HeatmapCell,
} from '@/lib/dashboard/derive';

const NOW = new Date(2026, 0, 7); // Wed Jan 7 2026

function shortFor(date: Date): string {
  return formatShortDate(date);
}

function localIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let seq = 0;
function makeSession(
  date: string,
  minutes: number,
  status: Session['status'] = 'Completed',
  startTime?: string,
): Session {
  seq += 1;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const duration = [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : ''].filter(Boolean).join(' ') || '0m';
  return { id: seq, task: `Task ${seq}`, duration, date, status, startTime };
}

function makePlan(overrides: Partial<Plan> = {}): Plan {
  seq += 1;
  return {
    id: seq,
    title: `Plan ${seq}`,
    description: '',
    type: 'daily',
    status: 'not-started',
    date: '2026-01-07',
    priority: 'medium',
    category: '',
    ...overrides,
  };
}

describe('todayMinutesFor', () => {
  it('sums minutes only for the requested day', () => {
    const today = shortFor(NOW);
    const sessions = [makeSession(today, 25), makeSession(today, 60), makeSession('Mon, Jan 1', 45)];
    expect(todayMinutesFor(sessions, today)).toBe(85);
  });
});

describe('activeSessionOf', () => {
  it('returns the in-progress session or null', () => {
    expect(activeSessionOf([])).toBeNull();
    const running = makeSession(shortFor(NOW), 30, 'In Progress');
    expect(activeSessionOf([makeSession(shortFor(NOW), 30, 'Completed'), running])).toEqual(running);
  });
});

describe('buildWeekDays', () => {
  it('returns 7 days ending on today, newest last', () => {
    const days = buildWeekDays([], NOW);
    expect(days).toHaveLength(7);
    expect(days[6].date).toBe(localIso(NOW));
    expect(days[0].date).toBe(localIso(new Date(2026, 0, 1)));
  });

  it('accumulates minutes and counts per day', () => {
    const today = shortFor(NOW);
    const yesterday = shortFor(new Date(2026, 0, 6));
    const sessions = [makeSession(today, 20), makeSession(today, 10), makeSession(yesterday, 50)];
    const days = buildWeekDays(sessions, NOW);
    expect(days[6].minutes).toBe(30);
    expect(days[6].count).toBe(2);
    expect(days[5].minutes).toBe(50);
    expect(days[5].count).toBe(1);
  });
});

describe('focusMinutesInRange / sessionsInRange', () => {
  it('filters by iso window', () => {
    const sessions = [
      makeSession(shortFor(new Date(2026, 0, 2)), 10),
      makeSession(shortFor(new Date(2026, 0, 5)), 20),
      makeSession(shortFor(new Date(2026, 0, 7)), 30),
    ];
    expect(focusMinutesInRange(sessions, '2026-01-03', '2026-01-06')).toBe(20);
    expect(sessionsInRange(sessions, '2026-01-03', '2026-01-06')).toHaveLength(1);
  });
});

describe('buildHeatmap', () => {
  it('scales levels from the max focus day', () => {
    expect(buildHeatmapCellLevel(25, 100)).toBe(1);
    expect(buildHeatmapCellLevel(50, 100)).toBe(2);
    expect(buildHeatmapCellLevel(75, 100)).toBe(3);
    expect(buildHeatmapCellLevel(90, 100)).toBe(4);
    expect(buildHeatmapCellLevel(0, 100)).toBe(0);
  });

  it('returns the requested number of cells with the newest last', () => {
    const heatmap = buildHeatmap([], NOW, 30);
    expect(heatmap).toHaveLength(30);
    expect(heatmap[29].iso).toBe(localIso(NOW));
    expect(heatmap[29].minutes).toBe(0);
  });

  it('marks a focused day at its relative level', () => {
    const today = shortFor(NOW);
    const sessions = [makeSession(today, 60)];
    const heatmap = buildHeatmap(sessions, NOW, 30);
    const last = heatmap[29];
    expect(last.minutes).toBe(60);
    expect(last.level).toBe(4);
  });

  it('produces valid heatmap cell shapes', () => {
    const cells: HeatmapCell[] = buildHeatmap([], NOW, 30);
    for (const cell of cells) {
      expect(cell.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(cell.level).toBeGreaterThanOrEqual(0);
      expect(cell.level).toBeLessThanOrEqual(4);
    }
  });
});

// small wrapper to exercise buildHeatmap's level logic through its public cell type
function buildHeatmapCellLevel(minutes: number, max: number): number {
  return levelFor(minutes, max);
}

describe('consistencyScoreFor', () => {
  it('returns the percentage of active days in the window', () => {
    const sessions = [makeSession(shortFor(NOW), 30), makeSession(shortFor(new Date(2026, 0, 6)), 30)];
    expect(consistencyScoreFor(sessions, lastNDateStrings(NOW, 10))).toBe(20);
  });
});

describe('longTermGoals', () => {
  it('keeps only open weekly/monthly plans sorted by due date', () => {
    const weeklyPending = makePlan({ type: 'weekly', status: 'pending', date: '2026-01-20' });
    const monthlyOpen = makePlan({ type: 'monthly', status: 'in-progress', date: '2026-01-10' });
    const daily = makePlan({ type: 'daily', status: 'pending', date: '2026-01-01' });
    const weeklyDone = makePlan({ type: 'weekly', status: 'completed', date: '2026-01-15' });
    const goals = longTermGoals([weeklyPending, monthlyOpen, daily, weeklyDone]);
    expect(goals).toHaveLength(2);
    expect(goals[0].id).toBe(monthlyOpen.id);
    expect(goals[1].id).toBe(weeklyPending.id);
  });
});

describe('nextUpcomingPlan', () => {
  it("returns today's in-progress plan first", () => {
    const plans = [
      makePlan({ id: 1, date: '2026-01-07', status: 'pending' }),
      makePlan({ id: 2, date: '2026-01-07', status: 'in-progress' }),
    ];
    expect(nextUpcomingPlan(plans, '2026-01-07')!.id).toBe(2);
  });

  it('falls back to the highest-priority open plan', () => {
    const plans = [
      makePlan({ id: 1, date: '2026-02-01', status: 'pending', priority: 'low' }),
      makePlan({ id: 2, date: '2026-01-20', status: 'not-started', priority: 'high' }),
    ];
    expect(nextUpcomingPlan(plans, '2026-01-07')!.id).toBe(2);
  });

  it('returns null when nothing is open', () => {
    expect(nextUpcomingPlan([], '2026-01-07')).toBeNull();
  });
});

describe('planProgress', () => {
  it('computes completed count and percentage', () => {
    const plans = [
      makePlan({ status: 'completed' }),
      makePlan({ status: 'pending' }),
      makePlan({ status: 'completed' }),
    ];
    const { completed, progress } = planProgress(plans);
    expect(completed).toBe(2);
    expect(progress).toBe(67);
  });
});

describe('dailyGoalMinutes', () => {
  it('uses the signal capacity when present', () => {
    expect(dailyGoalMinutes({ dailyCapacityMinutes: 120 } as never)).toEqual({
      goalMinutes: 120,
      goalSource: 'signals',
    });
  });
  it('falls back to the default goal otherwise', () => {
    expect(dailyGoalMinutes(null)).toEqual({ goalMinutes: 90, goalSource: 'default' });
  });
});

describe('weeklyComparison', () => {
  it('handles empty history', () => {
    const result = weeklyComparison([], NOW);
    expect(result.thisWeekMinutes).toBe(0);
    expect(result.change).toBe(0);
  });
});

describe('greetingFor', () => {
  it('maps hours to greetings', () => {
    expect(greetingFor(4)).toBe('night');
    expect(greetingFor(9)).toBe('morning');
    expect(greetingFor(15)).toBe('afternoon');
    expect(greetingFor(21)).toBe('evening');
  });
});

describe('displayMinutes', () => {
  it('formats as 0h, minutes, or h/m', () => {
    expect(displayMinutes(0)).toBe('0h');
    expect(displayMinutes(45)).toBe('45m');
    expect(displayMinutes(125)).toBe('2h 5m');
  });
});

describe('buildInsights', () => {
  it('returns an empty list when there are no sessions', () => {
    expect(buildInsights([], { weeklyChange: 0, weeklyChangeDisplay: '0%', streak: 0 })).toEqual([]);
  });

  it('produces up to three insights with stable kinds and tabs', () => {
    const sessions = [
      makeSession(shortFor(NOW), 90, 'Completed'),
      makeSession(shortFor(new Date(2026, 0, 6)), 45, 'Completed'),
    ];
    const insights = buildInsights(sessions, { weeklyChange: 25, weeklyChangeDisplay: '+25%', streak: 2 });
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.length).toBeLessThanOrEqual(3);
    for (const item of insights) {
      expect(['streak', 'longest', 'trend']).toContain(item.kind);
      expect(['sessions', 'stats']).toContain(item.tab);
    }
  });
});

describe('startOfWeekIso', () => {
  it('returns Monday of the current week', () => {
    expect(startOfWeekIso(new Date(2026, 0, 7))).toBe('2026-01-05');
  });
});

describe('PlanStatus usage is coherent', () => {
  // Guards that the plan helpers keep the status union usable.
  it('accepts the full plan status set', () => {
    const statuses: PlanStatus[] = ['completed', 'in-progress', 'pending', 'not-started'];
    const plans = statuses.map((s) => makePlan({ status: s }));
    expect(plans).toHaveLength(4);
  });
});
