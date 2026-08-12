import type { Plan, PlanPriority, Session } from '@/src/types';
import { parseDuration } from '@/src/utils/time';
import type { HistorySignals } from './types';

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const SHORT_DATE_RE = /^[A-Z][a-z]{2},\s*([A-Z][a-z]{2})\s+(\d{1,2})$/;

/** Converts the app's short session date ("Wed, Jan 1") into YYYY-MM-DD. */
export function shortDateToIso(value: string, now = new Date()): string | null {
  const match = SHORT_DATE_RE.exec(value.trim());
  if (!match) return null;
  const month = MONTHS[match[1]];
  if (month === undefined) return null;
  const date = new Date(now.getFullYear(), month, Number(match[2]));
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isoWeekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return (date.getDay() + 6) % 7; // 0 = Monday
}

/** Parses a wall-clock string ("14:30", "2:30 PM") into an hour 0-23, or null. */
export function hourOf(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const ampm = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/.exec(trimmed);
  if (!ampm) return null;
  let hour = Number(ampm[1]);
  const minutes = Number(ampm[2]);
  if (hour > 24 || minutes > 59) return null;
  const suffix = ampm[3]?.toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  return hour >= 0 && hour <= 23 ? hour : null;
}

function sessionMinutes(session: Session): number {
  return parseDuration(session.duration).totalMinutes;
}

/** Rough per-plan load used for overload detection when a plan has no estimate yet. */
function planLoadMinutes(type?: Plan['type'], priority?: PlanPriority): number {
  const base = type === 'daily' ? 30 : type === 'monthly' ? 240 : 90;
  const boost = priority === 'high' ? 1.3 : priority === 'low' ? 0.7 : 1;
  return Math.round(base * boost);
}

const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  Study: /\b(exam|study|learn|course|read|class|biology|math|review|assignment|homework)\b/i,
  Work: /\b(work|report|proposal|client|meeting|business|review|email|task|project)\b/i,
  Personal: /\b(personal|health|budget|finance|family|home|habit|gym|run)\b/i,
};

/**
 * Turns raw sessions + plans into the compact signals the assistant trusts. Pure and
 * deterministic so the whole recommendation engine stays unit-testable without storage.
 */
export function computeHistorySignals(sessions: Session[], plans: Plan[], now = new Date()): HistorySignals {
  const today = todayIso(now);

  const sessionMinutesByIso = new Map<string, number>();
  const sessionLengths: number[] = [];
  const weekdayMinutes = new Array<number>(7).fill(0);
  const hourMinutes = new Array<number>(24).fill(0);
  let bestHour: number | null = null;
  let bestWeekday: number | null = null;
  let maxHour = 0;
  let maxWeekday = 0;

  const categorySessions = new Map<string, { minutes: number[]; count: number }>();

  for (const session of sessions) {
    const minutes = sessionMinutes(session);
    if (minutes <= 0) continue;
    sessionLengths.push(minutes);
    const iso = shortDateToIso(session.date, now);
    if (iso) {
      sessionMinutesByIso.set(iso, (sessionMinutesByIso.get(iso) ?? 0) + minutes);
      const wd = isoWeekday(iso);
      weekdayMinutes[wd] += minutes;
      if (weekdayMinutes[wd] > maxWeekday) {
        maxWeekday = weekdayMinutes[wd];
        bestWeekday = wd;
      }
    }
    const hour = hourOf(session.startTime);
    if (hour !== null) {
      hourMinutes[hour] += minutes;
      if (hourMinutes[hour] > maxHour) {
        maxHour = hourMinutes[hour];
        bestHour = hour;
      }
    }
    for (const [category, re] of Object.entries(CATEGORY_KEYWORDS)) {
      if (re.test(session.task)) {
        const key = category.toLowerCase();
        const entry = categorySessions.get(key) ?? { minutes: [], count: 0 };
        entry.minutes.push(minutes);
        entry.count += 1;
        categorySessions.set(key, entry);
      }
    }
  }

  const allMinutes: number[] = [];
  for (const minutes of sessionMinutesByIso.values()) allMinutes.push(minutes);
  const sorted = [...sessionLengths].sort((a, b) => a - b);
  const median =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 1
        ? sorted[Math.floor(sorted.length / 2)]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

  const avgSession = sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
  const activeDays = allMinutes.length;
  const dailyCapacity = activeDays > 0 ? Math.round(allMinutes.reduce((a, b) => a + b, 0) / activeDays) : 0;
  const weeklyCapacity = Math.round(dailyCapacity * 5);

  const openPlans = plans
    .filter((p) => p.status !== 'completed')
    .map((p) => ({ id: p.id, title: p.title, date: p.date, category: p.category, priority: p.priority as PlanPriority }));

  const totalPlans = plans.length;
  const completedPlans = plans.filter((p) => p.status === 'completed').length;
  const planCompletionRate = totalPlans > 0 ? completedPlans / totalPlans : 0;

  const overdue = openPlans.filter((p) => p.date < today).length;
  const overdueRatio = openPlans.length > 0 ? overdue / openPlans.length : 0;

  const categoryStats: HistorySignals['categoryStats'] = {};
  const categories = new Set([
    ...plans.map((p) => p.category.trim().toLowerCase()).filter(Boolean),
    ...categorySessions.keys(),
  ]);
  for (const category of categories) {
    const plansOfCategory = plans.filter((p) => p.category.trim().toLowerCase() === category);
    const sessionData = categorySessions.get(category);
    const minutes = sessionData?.minutes ?? [];
    categoryStats[category] = {
      planCount: plansOfCategory.length,
      avgSessionMinutes: minutes.length > 0 ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : 0,
      sessionCount: sessionData?.count ?? 0,
    };
  }

  const openByDate = new Map<string, number>();
  for (const plan of plans) {
    if (plan.status === 'completed') continue;
    openByDate.set(plan.date, (openByDate.get(plan.date) ?? 0) + planLoadMinutes(plan.type, plan.priority));
  }

  const overloadDays: HistorySignals['overloadDays'] = [];
  const threshold = Math.max(60, dailyCapacity * 1.5);
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const iso = todayIso(d);
    const planned = openByDate.get(iso) ?? 0;
    if (planned > threshold) overloadDays.push({ date: iso, loadMinutes: planned });
  }

  return {
    avgSessionMinutes: avgSession,
    medianSessionMinutes: Math.round(median),
    sessionsPerDay: activeDays > 0 ? allMinutes.reduce((a, b) => a + b, 0) / activeDays : 0,
    sessionsPerWeek: activeDays > 0 ? weeklyCapacity / Math.max(1, avgSession) : 0,
    dailyCapacityMinutes: dailyCapacity,
    weeklyCapacityMinutes: weeklyCapacity,
    planCompletionRate,
    categoryStats,
    bestHour,
    bestWeekday,
    overloadDays,
    openPlans,
    overdueRatio,
    similarPlanCount: 0,
  };
}
