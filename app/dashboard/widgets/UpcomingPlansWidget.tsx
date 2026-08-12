'use client';

import { FiArrowRight, FiCheckCircle, FiCircle, FiPlus, FiTarget } from 'react-icons/fi';
import { getPlanStatusLabel } from '@/src/utils/badges';
import type { PlanPriority } from '@/src/types';
import type { DashboardWidgetProps } from './types';

function priorityChipClass(priority: PlanPriority): string {
  switch (priority) {
    case 'high':
      return 'bg-danger/10 text-danger border border-danger/15';
    case 'medium':
      return 'bg-warning/10 text-warning border border-warning/15';
    default:
      return 'bg-info/10 text-info border border-info/15';
  }
}

export default function UpcomingPlansWidget({ bundle, onNavigateTab, onUpdatePlanStatus }: DashboardWidgetProps) {
  const { todayPlans, todayPlansCompleted, todayPlanProgress, todayCount, nextPlan } = bundle;

  const handleToggle = (id: number, status: string) => {
    if (!onUpdatePlanStatus) return;
    onUpdatePlanStatus(id, status === 'completed' ? 'pending' : 'completed');
  };

  if (todayPlans.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-hover">
          <FiTarget className="text-text-muted" size={18} />
        </div>
        <p className="mt-3 text-[14px] text-text-secondary">No plans scheduled today</p>
        <p className="mt-0.5 text-[12px] text-text-muted">Create a plan to give your focus direction.</p>
        <button
          onClick={() => onNavigateTab('plans')}
          className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-accent hover:bg-accent-hover text-accent-contrast px-4 h-9 text-[13px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
        >
          <FiPlus size={15} /> Create a plan
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-text-secondary">
          {todayPlansCompleted} of {todayPlans.length} complete
        </span>
        <span className="font-medium text-text tabular-nums">{todayPlanProgress}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-surface-hover overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${todayPlanProgress}%` }}
        />
      </div>

      <ul className="mt-3 divide-y divide-divider">
        {todayPlans.slice(0, 4).map((plan) => {
          const done = plan.status === 'completed';
          return (
            <li key={plan.id} className="flex items-center gap-3 py-2.5">
              <button
                onClick={() => handleToggle(plan.id, plan.status)}
                className="shrink-0 flex items-center justify-center rounded-full text-border-hover hover:text-accent transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label={done ? `Mark "${plan.title}" as not completed` : `Mark "${plan.title}" as completed`}
              >
                {done ? <FiCheckCircle className="text-accent" size={18} /> : <FiCircle size={18} />}
              </button>
              <button
                onClick={() => onNavigateTab('plans')}
                className="min-w-0 flex-1 text-left rounded outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span className={`block text-[14px] truncate ${done ? 'line-through text-text-muted' : 'text-text'}`}>
                  {plan.title}
                </span>
                <span className="block text-[11px] text-text-muted mt-0.5">{getPlanStatusLabel(plan.status)}</span>
              </button>
              <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${priorityChipClass(plan.priority)}`}>
                {plan.priority}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-3">
        {todayCount === 0 && nextPlan && (
          <p className="mb-2 text-[12px] text-text-muted truncate">Next: {nextPlan.title}</p>
        )}
        <button
          onClick={() => onNavigateTab('plans')}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
        >
          See all plans <FiArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
