export type { Plan, PlanPriority, PlanStatus, PlanTypeValue } from '@/src/types';
export { PLAN_PRIORITY, PLAN_STATUS, PLAN_TYPE } from '@/src/types';

export interface Category {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

export interface Priority {
  id: string;
  label: string;
  color: string;
}

export interface PlanType {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}
