import {
  addDays,
  hourOf,
  isIsoDay,
  monthKey,
  todayKey,
  weekKey,
  weekStart,
  weekdayIndex,
  clampPercent,
} from '@/lib/analytics/periods';
import { HOURLY_BUCKETS } from '@/lib/analytics/types';
import type { DailyAnalyticsDoc, MonthlyAnalyticsDoc, WeeklyAnalyticsDoc } from '@/lib/mongodb/types';

/** Minimal session shape the aggregator understands (a superset of the stored doc). */
export interface AggregateSession {
  date: string;
  durationMinutes?: number;
  status?: string;
  startTime?: string;
  endTime?: string;
  startedAt?: string;
}

/** Minimal plan shape the aggregator understands. */
export interface AggregatePlan {
  date: string;
  status?: string;
  category?: string;
}

const GAP_BREAK_MS = 45 * 60 * 1000;
const GAP_INTERRUPTION_MS = 5 * 60 * 1000;

/** Concrete day-level rollup. Uses a plain interface (not a `Document`) so it stays
 *  structurally assignable to `DailyAnalyticsDoc` when `_id`/`userId` are added. */
export interface DayAggregation {
  date: string;
  focusMinutes: number;
  sessionsCompleted: number;
  sessionsMissed: number;
  sessionsInProgress: number;
  interruptions: number;
  breaks: number;
  avgSessionMinutes: number;
  plansCompleted: number;
  plansInProgress: number;
  plansPending: number;
  planCompletionRate: number;
  categoryFocusMinutes: Record<string, number>;
  hourlyMinutes: number[];
  bestHour: number | null;
  sharedFocusMinutes: number;
  computedAt: string;
}

function emptyDay(date: string): DayAggregation {
  return {
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
    hourlyMinutes: new Array<number>(HOURLY_BUCKETS).fill(0),
    bestHour: null,
    sharedFocusMinutes: 0,
    computedAt: todayKey(),
  };
}

/**
 * Pure day-level aggregation. `sharedFocusMinutes` is the user's share of any shared-focus
 * sessions that ended on this day (computed upstream), so per-user numbers stay per-user.
 */
export function aggregateDay(
  sessions: AggregateSession[],
  plans: AggregatePlan[],
  sharedFocusMinutes = 0,
): DayAggregation {
  const day = emptyDay(sessions[0]?.date ?? plans[0]?.date ?? todayKey());

  let completed = 0;
  let missed = 0;

  const timed: { start: number; minutes: number }[] = [];

  for (const session of sessions) {
    const minutes = Number.isFinite(Number(session.durationMinutes)) ? Number(session.durationMinutes) : 0;
    const status = (session.status ?? '').toLowerCase();
    const isCompleted = status === 'completed';
    const isInProgress = status === 'in progress';

    if (isCompleted) completed += 1;
    else if (status === 'missed') missed += 1;

    day.focusMinutes += minutes;
    day.sessionsCompleted += isCompleted ? 1 : 0;
    day.sessionsMissed += missed > 0 && status === 'missed' ? 1 : 0;
    day.sessionsInProgress += isInProgress ? 1 : 0;

    const hour = hourOf(session.startTime ?? session.startedAt);
    if (hour !== null) day.hourlyMinutes[hour] += minutes;

    const start = session.startTime ?? session.startedAt;
    if (start) {
      const ms = Date.parse(start);
      if (Number.isFinite(ms)) timed.push({ start: ms, minutes });
    }
  }

  if (completed > 0) day.avgSessionMinutes = Math.round(day.focusMinutes / Math.max(1, completed));

  // Break / interruption detection: sort in-day recordings by wall-clock start; any gap
  // between consecutive records is a "break" when long, otherwise an "interruption".
  timed.sort((a, b) => a.start - b.start);
  for (let i = 1; i < timed.length; i += 1) {
    const gap = timed[i].start - timed[i - 1].start - timed[i - 1].minutes * 60 * 1000;
    if (gap > GAP_BREAK_MS) day.breaks += 1;
    else if (gap >= GAP_INTERRUPTION_MS) day.interruptions += 1;
  }

  let planTotal = 0;
  for (const plan of plans) {
    const status = plan.status ?? 'not-started';
    planTotal += 1;
    if (status === 'completed') day.plansCompleted += 1;
    else if (status === 'in-progress') day.plansInProgress += 1;
    else if (status === 'pending' || status === 'not-started') day.plansPending += 1;

    const category = (plan.category ?? '').trim() || 'Uncategorised';
    day.categoryFocusMinutes[category] = (day.categoryFocusMinutes[category] ?? 0) + 0;
  }

  if (planTotal > 0) day.planCompletionRate = clampPercent(day.plansCompleted / planTotal);
  day.plansPending = Math.max(0, day.plansPending);

  day.bestHour = day.hourlyMinutes.indexOf(Math.max(...day.hourlyMinutes));
  if (day.hourlyMinutes.every((v) => v === 0)) day.bestHour = null;
  day.sharedFocusMinutes += sharedFocusMinutes;

  return day;
}

/** Roll N day summaries into a single week summary (keyed by its Monday). */
export function rollupWeek(dailies: DailyAnalyticsDoc[]): WeeklyAnalyticsDoc {
  const first = dailies[0];
  const weekStartKey = first ? weekStart(first.date) : weekKey(todayKey());

  const hourly = new Array<number>(HOURLY_BUCKETS).fill(0);
  const byWeekday = new Array<number>(7).fill(0);
  const categoryScores = new Map<string, number>();
  let focusMinutes = 0;
  let sessions = 0;
  let planRateSum = 0;
  let planRateCount = 0;
  let daysWithFocus = 0;

  for (const d of dailies) {
    focusMinutes += d.focusMinutes;
    sessions += d.sessionsCompleted;
    daysWithFocus += d.focusMinutes > 0 ? 1 : 0;
    planRateSum += d.planCompletionRate;
    planRateCount += d.plansCompleted > 0 || d.plansPending > 0 || d.plansInProgress > 0 ? 1 : 0;
    for (let h = 0; h < HOURLY_BUCKETS; h += 1) hourly[h] += d.hourlyMinutes[h];
    byWeekday[weekdayIndex(d.date)] += d.focusMinutes;
    for (const [cat, min] of Object.entries(d.categoryFocusMinutes)) {
      categoryScores.set(cat, (categoryScores.get(cat) ?? 0) + min);
    }
  }

  let bestDayIndex: number | null = null;
  let bestDayValue = 0;
  for (let i = 0; i < 7; i += 1) {
    if (byWeekday[i] > bestDayValue) {
      bestDayValue = byWeekday[i];
      bestDayIndex = i;
    }
  }
  if (bestDayValue <= 0) bestDayIndex = null;

  let topCategory: string | null = null;
  let topValue = 0;
  for (const [cat, value] of categoryScores) {
    if (value > topValue) {
      topValue = value;
      topCategory = cat;
    }
  }

  return {
    _id: `${first?.userId ?? ''}:${weekStartKey}`,
    userId: first?.userId ?? '',
    weekStart: weekStartKey,
    focusMinutes,
    sessionsCompleted: sessions,
    planCompletionRate: planRateCount > 0 ? clampPercent(planRateSum / planRateCount) : 0,
    dailyAverageMin: Math.round(focusMinutes / Math.max(1, daysWithFocus || 1)),
    bestDayIndex,
    hourlyMinutes: hourly,
    topCategory,
    daysWithFocus,
    computedAt: todayKey(),
  };
}

/** Roll N week summaries into a month summary (keyed by YYYY-MM). */
export function rollupMonth(weeks: WeeklyAnalyticsDoc[]): MonthlyAnalyticsDoc {
  const first = weeks[0];
  const month = first ? monthKey(first.weekStart) : monthKey(todayKey());

  const preferred = new Array<number>(HOURLY_BUCKETS).fill(0);
  const byWeekday = new Array<number>(7).fill(0);
  const categoryScores = new Map<string, number>();
  const trend: number[] = [];
  let focusMinutes = 0;
  let sessions = 0;
  let planRateSum = 0;
  let planRateCount = 0;

  for (const w of weeks) {
    focusMinutes += w.focusMinutes;
    sessions += w.sessionsCompleted;
    planRateSum += w.planCompletionRate;
    planRateCount += 1;
    trend.push(w.focusMinutes);
    for (let h = 0; h < HOURLY_BUCKETS; h += 1) preferred[h] += w.hourlyMinutes[h];
    if (w.bestDayIndex !== null) byWeekday[w.bestDayIndex] += 1;
    if (w.topCategory) categoryScores.set(w.topCategory, (categoryScores.get(w.topCategory) ?? 0) + 1);
  }

  const preferredHours: number[] = [];
  const maxHour = Math.max(...preferred, 0);
  for (let h = 0; h < HOURLY_BUCKETS; h += 1) {
    if (maxHour > 0 && preferred[h] === maxHour) preferredHours.push(h);
  }

  let bestWeekdayIndex: number | null = null;
  let bestWeekdayValue = 0;
  for (let i = 0; i < 7; i += 1) {
    if (byWeekday[i] > bestWeekdayValue) {
      bestWeekdayValue = byWeekday[i];
      bestWeekdayIndex = i;
    }
  }
  if (bestWeekdayValue <= 0) bestWeekdayIndex = null;

  let topCategory: string | null = null;
  let topValue = 0;
  for (const [cat, value] of categoryScores) {
    if (value > topValue) {
      topValue = value;
      topCategory = cat;
    }
  }

  return {
    _id: `${first?.userId ?? ''}:${month}`,
    userId: first?.userId ?? '',
    month,
    focusMinutes,
    sessionsCompleted: sessions,
    planCompletionRate: planRateCount > 0 ? clampPercent(planRateSum / planRateCount) : 0,
    weeklyAverageMin: Math.round(focusMinutes / Math.max(1, weeks.length)),
    preferredHours,
    bestWeekdayIndex,
    topCategory,
    weekCount: weeks.length,
    trend,
    computedAt: todayKey(),
  };
}

/** Buckets day keys into Monday-started weeks (sorted). */
export function groupByWeek(dailies: DailyAnalyticsDoc[]): Map<string, DailyAnalyticsDoc[]> {
  const groups = new Map<string, DailyAnalyticsDoc[]>();
  for (const d of dailies) {
    const key = weekStart(d.date);
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }
  return groups;
}

/** Buckets day keys into months (sorted). */
export function groupByMonth(dailies: DailyAnalyticsDoc[]): Map<string, DailyAnalyticsDoc[]> {
  const groups = new Map<string, DailyAnalyticsDoc[]>();
  for (const d of dailies) {
    const key = monthKey(d.date);
    const list = groups.get(key) ?? [];
    list.push(d);
    groups.set(key, list);
  }
  return groups;
}

/** True when the day key is valid and recent enough to matter (within the last 400 days). */
export function isAnalyzableDay(day: string): boolean {
  if (!isIsoDay(day)) return false;
  const cutoff = addDays(todayKey(), -400);
  return day >= cutoff && day <= addDays(todayKey(), 1);
}
