'use client';

import { useEffect } from 'react';
import { useStorage } from '@/src/hooks/useStorage';
import { useSessions } from '@/src/hooks/useSessions';
import { usePlans } from '@/src/hooks/usePlans';
import { useStatistics } from '@/src/hooks/useStatistics';
import type { AppData } from '@/src/types';

export interface UseDashboardResult {
  isLoading: boolean;
  error: string | null;
  sessions: ReturnType<typeof useSessions>['sessions'];
  plans: ReturnType<typeof usePlans>['plans'];
  stats: ReturnType<typeof useStatistics>;
  sessionApi: Omit<ReturnType<typeof useSessions>, 'sessions'>;
  planApi: Omit<ReturnType<typeof usePlans>, 'plans'>;
  storageApi: Pick<ReturnType<typeof useStorage>, 'save' | 'reload'>;
}

export function useDashboard(): UseDashboardResult {
  const { data, isLoading, error, patchData, save, reload } = useStorage();
  const sessionApi = useSessions(data.sessions);
  const planApi = usePlans(data.plans);
  const stats = useStatistics(sessionApi.sessions, planApi.plans);

  useEffect(() => {
    sessionApi.replaceAll(data.sessions);
    planApi.replaceAll(data.plans);
  }, [data]);

  useEffect(() => {
    patchData({
      sessions: sessionApi.sessions,
      plans: planApi.plans,
    });
  }, [sessionApi.sessions, planApi.plans]);

  return {
    isLoading,
    error,
    sessions: sessionApi.sessions,
    plans: planApi.plans,
    stats,
    sessionApi: {
      setSessions: sessionApi.setSessions,
      addSession: sessionApi.addSession,
      updateSession: sessionApi.updateSession,
      deleteSession: sessionApi.deleteSession,
      replaceAll: sessionApi.replaceAll,
    },
    planApi: {
      setPlans: planApi.setPlans,
      addPlan: planApi.addPlan,
      updatePlanStatus: planApi.updatePlanStatus,
      deletePlan: planApi.deletePlan,
      replaceAll: planApi.replaceAll,
    },
    storageApi: { save, reload },
  };
}

export type { AppData };
