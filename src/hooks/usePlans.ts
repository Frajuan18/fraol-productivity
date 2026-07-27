'use client';

import { useCallback, useState } from 'react';
import { PLAN_STATUS } from '@/src/types';
import type { Plan, PlanStatus } from '@/src/types';

export interface UsePlansResult {
  plans: Plan[];
  setPlans: (plans: Plan[]) => void;
  addPlan: (plan: Plan) => void;
  updatePlanStatus: (id: number, status: PlanStatus) => void;
  deletePlan: (id: number) => void;
  replaceAll: (plans: Plan[]) => void;
}

export function usePlans(initial: Plan[] = []): UsePlansResult {
  const [plans, setPlansState] = useState<Plan[]>(initial);

  const setPlans = useCallback((next: Plan[]) => {
    setPlansState(next);
  }, []);

  const addPlan = useCallback((plan: Plan) => {
    setPlansState((prev) => [...prev, plan]);
  }, []);

  const updatePlanStatus = useCallback((id: number, status: PlanStatus) => {
    setPlansState((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const deletePlan = useCallback((id: number) => {
    setPlansState((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const replaceAll = useCallback((next: Plan[]) => {
    setPlansState(next);
  }, []);

  return {
    plans,
    setPlans,
    addPlan,
    updatePlanStatus,
    deletePlan,
    replaceAll,
  };
}

export function createPlan(input: Omit<Plan, 'id' | 'status'> & { status?: PlanStatus }): Plan {
  return {
    ...input,
    id: Date.now(),
    status: input.status ?? PLAN_STATUS.NOT_STARTED,
  };
}
