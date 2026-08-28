'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRepository } from '@/lib/repositories/repository';
import { useStatistics, type DashboardStatistics } from '@/src/hooks/useStatistics';
import { formatShortDate, toIsoDateString } from '@/src/utils/date';
import { formatMinutesAsHoursMinutes, sumSessionMinutes } from '@/src/utils/time';
import {
  activeSessionOf,
  buildFocusDistribution,
  buildHeatmap,
  buildInsights,
  buildWeekDays,
  consistencyScoreFor,
  dailyGoalMinutes,
  greetingFor,
  lastNDateStrings,
  longTermGoals,
  nextUpcomingPlan,
  planProgress,
  sessionsInRange,
  startOfWeekIso,
  todayMinutesFor,
  weeklyComparison,
  type FocusDistributionSlice,
  type HeatmapCell,
  type InsightSlice,
  type WeekDaySlice,
} from './derive';
import type { HistorySignals } from '@/lib/assistant/types';
import type { AnalyticsResult } from '@/lib/analytics/types';
import type { Plan, Session } from '@/src/types';

export interface DashboardBundle {
  loading: boolean;
  error: string | null;
  refresh: () => void;
  signals: HistorySignals | null;
  userName: string;
  greeting: 'morning' | 'afternoon' | 'evening' | 'night';
  stats: DashboardStatistics;
  todayMinutes: number;
  todayDisplay: string;
  todayCount: number;
  todayCompleted: number;
  activeSession: Session | null;
  activeSessionDisplay: string;
  goalMinutes: number;
  goalSource: 'signals' | 'default';
  todayPlans: Plan[];
  todayPlansCompleted: number;
  todayPlanProgress: number;
  weekDays: WeekDaySlice[];
  weekMinutes: number;
  weekDisplay: string;
  weekChange: number;
  weekChangeDisplay: string;
  weekCompleted: number;
  weekSessionCount: number;
  consistencyScore: number;
  upcomingPlans: Plan[];
  nextPlan: Plan | null;
  recentSessions: Session[];
  longTermGoals: Plan[];
  heatmap: HeatmapCell[];
  insights: InsightSlice[];
  focusDistribution: FocusDistributionSlice[];
  analytics: AnalyticsResult | null;
}

interface UseDashboardDataInput {
  sessions: Session[];
  plans: Plan[];
  user: string | null;
  analytics: AnalyticsResult | null;
}

/**
 * Single data bundle shared by every dashboard widget. The overview owns the raw AppData
 * (already loaded by the page) and this hook derives every slice the widgets render, plus
 * the assistant's history signals — fetched once and cached across all widgets.
 */
export function useDashboardData({ sessions, plans, user, analytics }: UseDashboardDataInput): DashboardBundle {
  const repository = getRepository();
  const [signals, setSignals] = useState<HistorySignals | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState<string | null>(null);

  const loadSignals = useCallback(() => {
    let cancelled = false;
    repository
      .getPlanningSignals('')
      .then((value) => {
        if (!cancelled) setSignals(value);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSignalsError(error instanceof Error ? error.message : 'Failed to load focus signals.');
        }
      })
      .finally(() => {
        if (!cancelled) setSignalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => loadSignals(), [loadSignals]);

  const refresh = useCallback(() => {
    setSignalsError(null);
    loadSignals();
  }, [loadSignals]);

  const stats = useStatistics(sessions, plans);

  return useMemo(() => {
    const now = new Date();
    const todayStr = formatShortDate(now);
    const todayIso = toIsoDateString(now);
    const hour = now.getHours();

    const todayMinutes = todayMinutesFor(sessions, todayStr);
    const todaySessions = sessions.filter((s) => s.date === todayStr);
    const todayCompleted = todaySessions.filter((s) => s.status === 'Completed').length;
    const activeSession = activeSessionOf(sessions);
    const activeSessionDisplay = activeSession ? formatMinutesAsHoursMinutes(sumSessionMinutes([activeSession])) : '';

    const weekDays = buildWeekDays(sessions, now);
    const week = weeklyComparison(sessions, now);
    const goal = dailyGoalMinutes(signals);

    const weekRangeSessions = sessionsInRange(sessions, startOfWeekIso(now), todayIso);
    const weekCompleted = weekRangeSessions.filter((s) => s.status === 'Completed').length;

    const todayPlans = plans.filter((p) => p.date === todayIso);
    const planResult = planProgress(todayPlans);

    const consistencyScore = consistencyScoreFor(sessions, lastNDateStrings(now, 30));
    const recentSessions = [...sessions].slice(0, 5);
    const heatmap = buildHeatmap(sessions, now, 30);
    const goals = longTermGoals(plans);
    const nextPlan = nextUpcomingPlan(plans, todayIso);
    const insights = buildInsights(sessions, {
      weeklyChange: week.change,
      weeklyChangeDisplay: week.changeDisplay,
      streak: stats.streak,
    });
    const focusDistribution = buildFocusDistribution(sessions);

    const userName = user && user.trim() ? user.trim() : 'friend';

    return {
      loading: signalsLoading,
      error: signalsError,
      refresh,
      signals,
      userName,
      greeting: greetingFor(hour),
      stats,
      todayMinutes,
      todayDisplay: formatMinutesAsHoursMinutes(todayMinutes),
      todayCount: todaySessions.length,
      todayCompleted,
      activeSession,
      activeSessionDisplay,
      goalMinutes: goal.goalMinutes,
      goalSource: goal.goalSource,
      todayPlans,
      todayPlansCompleted: planResult.completed,
      todayPlanProgress: planResult.progress,
      weekDays,
      weekMinutes: week.thisWeekMinutes,
      weekDisplay: formatMinutesAsHoursMinutes(week.thisWeekMinutes),
      weekChange: week.change,
      weekChangeDisplay: week.changeDisplay,
      weekCompleted,
      weekSessionCount: weekRangeSessions.length,
      consistencyScore,
      upcomingPlans: [...plans].filter((p) => p.status !== 'completed').slice(0, 5),
      nextPlan,
      recentSessions,
      longTermGoals: goals,
      heatmap,
      insights,
      focusDistribution,
      analytics,
    };
  }, [sessions, plans, user, signals, signalsLoading, signalsError, refresh, stats, analytics]);
}
