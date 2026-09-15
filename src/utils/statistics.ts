import { SESSION_STATUS, PLAN_STATUS, type Session, type Plan } from '@/src/types';
import { formatShortDate, getPreviousWeekStart, getWeekStart, isSameDay, parseSessionDate } from '@/src/utils/date';
import { parseDuration, sumSessionMinutes } from '@/src/utils/time';

export function countSessionsByStatus(sessions: ReadonlyArray<Session>, status: Session['status']): number {
  return sessions.filter((s) => s.status === status).length;
}

export function countPlansByStatus(plans: ReadonlyArray<Plan>, status: Plan['status']): number {
  return plans.filter((p) => p.status === status).length;
}

export function calculateSuccessRate(sessions: ReadonlyArray<Session>): number {
  if (sessions.length === 0) return 0;
  const completed = countSessionsByStatus(sessions, SESSION_STATUS.COMPLETED);
  return Math.round((completed / sessions.length) * 100);
}

export function calculatePlanCompletionRate(plans: ReadonlyArray<Plan>): number {
  if (plans.length === 0) return 0;
  const completed = countPlansByStatus(plans, PLAN_STATUS.COMPLETED);
  return Math.round((completed / plans.length) * 100);
}

export function focusMinutesForDay(sessions: ReadonlyArray<Session>, day: Date): number {
  const daySessions = sessions.filter((s) => s.date === formatShortDate(day));
  return sumSessionMinutes(daySessions);
}

export function focusMinutesThisWeek(sessions: ReadonlyArray<Session>): number {
  const weekStart = getWeekStart();
  const today = new Date();
  return sessions
    .filter((s) => {
      const sessionDate = parseSessionDate(s.date);
      return sessionDate && sessionDate >= weekStart && sessionDate <= today;
    })
    .reduce((total, session) => total + parseDuration(session.duration).totalMinutes, 0);
}

export function focusMinutesLastWeek(sessions: ReadonlyArray<Session>): number {
  const lastWeekStart = getPreviousWeekStart();
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);

  return sessions
    .filter((s) => {
      const sessionDate = parseSessionDate(s.date);
      return sessionDate && sessionDate >= lastWeekStart && sessionDate <= lastWeekEnd;
    })
    .reduce((total, session) => total + parseDuration(session.duration).totalMinutes, 0);
}

export function calculateWeeklyChange(sessions: ReadonlyArray<Session>): { change: number; display: string } {
  const weekly = focusMinutesThisWeek(sessions);
  const lastWeek = focusMinutesLastWeek(sessions);

  if (lastWeek === 0 && weekly === 0) return { change: 0, display: '0%' };
  if (lastWeek === 0) return { change: 100, display: '+100%' };

  const change = ((weekly - lastWeek) / lastWeek) * 100;
  const rounded = Math.round(change);
  return {
    change: rounded,
    display: rounded > 0 ? `+${rounded}%` : `${rounded}%`,
  };
}

export function calculateStreak(sessions: ReadonlyArray<Session>): number {
  if (sessions.length === 0) return 0;

  const today = new Date();
  const todayStr = formatShortDate(today);

  const hasTodaySession = sessions.some((s) => s.date === todayStr && s.status === SESSION_STATUS.COMPLETED);

  if (!hasTodaySession) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatShortDate(yesterday);
    const hasYesterdaySession = sessions.some((s) => s.date === yesterdayStr && s.status === SESSION_STATUS.COMPLETED);
    if (!hasYesterdaySession) return 0;
  }

  let streak = 0;
  const cursor = new Date(today);
  if (!hasTodaySession) cursor.setDate(cursor.getDate() - 1);

  const maxIterations = 365 * 5;
  let iterations = 0;

  while (iterations < maxIterations) {
    const dateStr = formatShortDate(cursor);
    const hasSession = sessions.some((s) => s.date === dateStr && s.status === SESSION_STATUS.COMPLETED);

    if (hasSession) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
    iterations++;
  }

  return streak;
}

export function groupSessionsByDate(sessions: ReadonlyArray<Session>): Record<string, Session[]> {
  return sessions.reduce<Record<string, Session[]>>((groups, session) => {
    (groups[session.date] ??= []).push(session);
    return groups;
  }, {});
}

export function sortedSessionDates(sessions: ReadonlyArray<Session>): string[] {
  return Object.keys(groupSessionsByDate(sessions)).sort((a, b) => {
    const da = parseSessionDate(b)?.getTime() ?? 0;
    const db = parseSessionDate(a)?.getTime() ?? 0;
    return da - db;
  });
}

export function hasSessionOnDate(sessions: ReadonlyArray<Session>, day: Date): boolean {
  const dateStr = formatShortDate(day);
  return sessions.some((s) => s.date === dateStr);
}

export function sessionCountOnDate(sessions: ReadonlyArray<Session>, day: Date): number {
  const dateStr = formatShortDate(day);
  return sessions.filter((s) => s.date === dateStr).length;
}

export function sessionsOnDate(sessions: ReadonlyArray<Session>, day: Date): Session[] {
  const dateStr = formatShortDate(day);
  return sessions.filter((s) => s.date === dateStr);
}

export { isSameDay };
