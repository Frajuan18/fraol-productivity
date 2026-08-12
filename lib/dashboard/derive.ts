/**
 * Phase 18 — Pure dashboard derivation.
 *
 * Turns raw sessions/plans/user + optional analytics/signals into the slices every widget
 * consumes. Kept pure so the numbers are unit-testable without React or storage; the hook
 * (useDashboard.ts) only wires these results to state.
 */
import type { Plan, PlanStatus, Session } from '@/src/types';
import type { HistorySignals } from '@/lib/assistant/types';
import { shortDateToIso } from '@/lib/assistant/signals';
import { formatShortDate } from '@/src/utils/date';
import { formatMinutesAsHoursMinutes, sumSessionMinutes } from '@/src/utils/time';

export const PLAN_ORDER: PlanStatus[] = ['in-progress', 'pending', 'not-started'];

/** Local YYYY-MM-DD (matches `shortDateToIso` so session dates and windows align). */
function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayMinutesFor(sessions: Session[], today: string): number {
  return sumSessionMinutes(sessions.filter((s) => s.date === today));
}

export function activeSessionOf(sessions: Session[]): Session | null {
  return sessions.find((s) => s.status === 'In Progress') ?? null;
}

export interface WeekDaySlice {
  label: string;
  short: string;
  date: string;
  minutes: number;
  count: number;
}

export function buildWeekDays(sessions: Session[], now: Date): WeekDaySlice[] {
  const days: WeekDaySlice[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = formatShortDate(d);
    const daySessions = sessions.filter((s) => s.date === dateStr);
    days.push({
      label: d.toLocaleDateString('en-US', { weekday: 'long' }),
      short: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: toLocalIso(d),
      minutes: sumSessionMinutes(daySessions),
      count: daySessions.length,
    });
  }
  return days;
}

export function focusMinutesInRange(sessions: Session[], fromIso: string, toIso: string): number {
  return sessionsInRange(sessions, fromIso, toIso).reduce((total, s) => total + sumSessionMinutes([s]), 0);
}

export function sessionsInRange(sessions: Session[], fromIso: string, toIso: string): Session[] {
  return sessions.filter((s) => {
    const iso = shortDateToIso(s.date) ?? s.date;
    return iso >= fromIso && iso <= toIso;
  });
}

export function startOfWeekIso(date: Date): string {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
  return toLocalIso(start);
}

export interface HeatmapCell {
  date: string;
  iso: string;
  minutes: number;
  level: 0 | 1 | 2 | 3 | 4;
}

/** Last `days` days of focus as a heatmap-ready grid (newest last). */
export function buildHeatmap(sessions: Session[], now: Date, days = 30): HeatmapCell[] {
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    byDate.set(s.date, (byDate.get(s.date) ?? 0) + sumSessionMinutes([s]));
  }
  const cells: HeatmapCell[] = [];
  let max = 0;
  const rows: { date: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = toLocalIso(d);
    const minutes = byDate.get(formatShortDate(d)) ?? 0;
    if (minutes > max) max = minutes;
    rows.push({ date: iso, minutes });
  }
  for (const row of rows) {
    cells.push({ date: row.date, iso: row.date, minutes: row.minutes, level: levelFor(row.minutes, max) });
  }
  return cells;
}

export function levelFor(minutes: number, max: number): HeatmapCell['level'] {
  if (minutes <= 0) return 0;
  if (max <= 0) return 1;
  const ratio = minutes / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function consistencyScoreFor(sessions: Session[], days: string[]): number {
  if (days.length === 0) return 0;
  const activeDays = new Set(sessions.map((s) => s.date));
  const count = days.filter((d) => activeDays.has(d)).length;
  return Math.round((count / days.length) * 100);
}

export function lastNDateStrings(now: Date, n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(formatShortDate(d));
  }
  return dates;
}

/** Open plans that are monthly/weekly scope (long-term goals), sorted by due date. */
export function longTermGoals(plans: Plan[]): Plan[] {
  return plans
    .filter((p) => p.status !== 'completed' && (p.type === 'monthly' || p.type === 'weekly'))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Highest-priority open plan, then the first that is today's, then the earliest due. */
export function nextUpcomingPlan(plans: Plan[], todayIso: string): Plan | null {
  const open = plans.filter((p) => p.status !== 'completed');
  for (const status of PLAN_ORDER) {
    const candidate = open.find((p) => p.status === status && p.date === todayIso);
    if (candidate) return candidate;
  }
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const ranked = [...open].sort((a, b) => {
    const priority = (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3);
    if (priority !== 0) return priority;
    return a.date.localeCompare(b.date);
  });
  return ranked[0] ?? null;
}

export function planProgress(todayPlans: Plan[]): { completed: number; progress: number } {
  const completed = todayPlans.filter((p) => p.status === 'completed').length;
  return {
    completed,
    progress: todayPlans.length > 0 ? Math.round((completed / todayPlans.length) * 100) : 0,
  };
}

export interface DailyGoalEstimate {
  goalMinutes: number;
  goalSource: 'signals' | 'default';
}

export function dailyGoalMinutes(signals: HistorySignals | null): DailyGoalEstimate {
  if (signals && signals.dailyCapacityMinutes > 0) {
    return { goalMinutes: signals.dailyCapacityMinutes, goalSource: 'signals' };
  }
  return { goalMinutes: 90, goalSource: 'default' };
}

export function weeklyComparison(
  sessions: Session[],
  now: Date,
): { thisWeekMinutes: number; change: number; changeDisplay: string } {
  const weekStart = startOfWeekIso(now);
  const thisWeek = focusMinutesInRange(sessions, weekStart, toLocalIso(now));
  const lastStart = startOfWeekIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
  const lastEnd = toLocalIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const lastWeek = focusMinutesInRange(sessions, lastStart, lastEnd);
  if (lastWeek === 0 && thisWeek === 0) return { thisWeekMinutes: thisWeek, change: 0, changeDisplay: '0%' };
  if (lastWeek === 0) return { thisWeekMinutes: thisWeek, change: 100, changeDisplay: '+100%' };
  const change = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  return { thisWeekMinutes: thisWeek, change, changeDisplay: change > 0 ? `+${change}%` : `${change}%` };
}

export function greetingFor(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function displayMinutes(minutes: number): string {
  return formatMinutesAsHoursMinutes(minutes);
}

export interface InsightSlice {
  id: string;
  kind: 'streak' | 'longest' | 'trend';
  text: string;
  action: string;
  tab: 'sessions' | 'stats';
}

/** Up to three, stable insights derived purely from the data available to the overview. */
export function buildInsights(sessions: Session[], stats: { weeklyChange: number; weeklyChangeDisplay: string; streak: number }): InsightSlice[] {
  if (sessions.length === 0) return [];
  const insights: InsightSlice[] = [];
  let longest = 0;
  let bestDayLabel = '';
  let bestDayMinutes = 0;
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const minutes = sumSessionMinutes([s]);
    if (minutes > longest) longest = minutes;
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + minutes);
  }
  for (const [date, minutes] of byDay) {
    if (minutes > bestDayMinutes) {
      bestDayMinutes = minutes;
      bestDayLabel = date;
    }
  }
  if (bestDayLabel) {
    insights.push({
      id: 'streak-day',
      kind: 'streak',
      text: `Your strongest focus day was ${bestDayLabel}.`,
      action: 'View sessions',
      tab: 'sessions',
    });
  }
  if (longest > 0) {
    insights.push({
      id: 'longest-session',
      kind: 'longest',
      text: `Your longest focus session was ${displayMinutes(longest)}.`,
      action: 'View sessions',
      tab: 'sessions',
    });
  }
  if (stats.weeklyChange !== 0) {
    insights.push({
      id: 'weekly-trend',
      kind: 'trend',
      text: `You focused ${stats.weeklyChangeDisplay} ${stats.weeklyChange > 0 ? 'more' : 'less'} than last week.`,
      action: 'View statistics',
      tab: 'stats',
    });
  }
  return insights.slice(0, 3);
}