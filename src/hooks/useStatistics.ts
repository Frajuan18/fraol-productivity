'use client';

import { useMemo } from 'react';
import { SESSION_STATUS, PLAN_STATUS } from '@/src/types';
import type { Plan, Session } from '@/src/types';
import {
  calculateStreak,
  calculateSuccessRate,
  calculatePlanCompletionRate,
  countSessionsByStatus,
  countPlansByStatus,
  focusMinutesThisWeek,
  focusMinutesLastWeek,
  calculateWeeklyChange,
} from '@/src/utils/statistics';

export interface DashboardStatistics {
  streak: number;
  successRate: number;
  planCompletionRate: number;
  focusMinutesThisWeek: number;
  focusMinutesLastWeek: number;
  weeklyChange: number;
  weeklyChangeDisplay: string;
  sessionCounts: {
    completed: number;
    inProgress: number;
    missed: number;
    total: number;
  };
  planCounts: {
    completed: number;
    inProgress: number;
    pending: number;
    notStarted: number;
    total: number;
  };
}

export function useStatistics(sessions: Session[], plans: Plan[]): DashboardStatistics {
  return useMemo(() => {
    const sessionCounts = {
      completed: countSessionsByStatus(sessions, SESSION_STATUS.COMPLETED),
      inProgress: countSessionsByStatus(sessions, SESSION_STATUS.IN_PROGRESS),
      missed: countSessionsByStatus(sessions, SESSION_STATUS.MISSED),
      total: sessions.length,
    };

    const planCounts = {
      completed: countPlansByStatus(plans, PLAN_STATUS.COMPLETED),
      inProgress: countPlansByStatus(plans, PLAN_STATUS.IN_PROGRESS),
      pending: countPlansByStatus(plans, PLAN_STATUS.PENDING),
      notStarted: countPlansByStatus(plans, PLAN_STATUS.NOT_STARTED),
      total: plans.length,
    };

    const thisWeek = focusMinutesThisWeek(sessions);
    const lastWeek = focusMinutesLastWeek(sessions);
    const { change, display } = calculateWeeklyChange(sessions);

    return {
      streak: calculateStreak(sessions),
      successRate: calculateSuccessRate(sessions),
      planCompletionRate: calculatePlanCompletionRate(plans),
      focusMinutesThisWeek: thisWeek,
      focusMinutesLastWeek: lastWeek,
      weeklyChange: change,
      weeklyChangeDisplay: display,
      sessionCounts,
      planCounts,
    };
  }, [sessions, plans]);
}
