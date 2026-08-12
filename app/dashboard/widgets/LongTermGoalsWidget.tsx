'use client';

import { FiTarget } from 'react-icons/fi';
import { getPlanStatusLabel } from '@/src/utils/badges';
import { formatShortDate } from '@/src/utils/date';
import type { DashboardWidgetProps } from './types';

export default function LongTermGoalsWidget({ bundle, onNavigateTab }: DashboardWidgetProps) {
  const { longTermGoals } = bundle;

  if (longTermGoals.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-hover">
          <FiTarget className="text-text-muted" size={18} />
        </div>
        <p className="mt-3 text-[14px] text-text-secondary">No open long-term goals.</p>
        <p className="mt-0.5 text-[12px] text-text-muted">Add a weekly or monthly plan to track one here.</p>
        <button
          onClick={() => onNavigateTab('plans')}
          className="mt-4 inline-flex items-center rounded-[10px] bg-accent hover:bg-accent-hover text-accent-contrast px-4 h-9 text-[13px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
        >
          New plan
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="divide-y divide-divider">
        {longTermGoals.slice(0, 4).map((plan) => {
          const typeLabel = plan.type === 'monthly' ? 'Monthly' : 'Weekly';
          const status = plan.status;
          return (
            <li key={plan.id} className="flex items-center gap-3 py-2.5">
              <span className="shrink-0 rounded-lg bg-accent-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {typeLabel}
              </span>
              <button
                onClick={() => onNavigateTab('plans')}
                className="min-w-0 flex-1 text-left rounded outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span className="block truncate text-[14px] text-text">{plan.title}</span>
                <span className="block text-[11px] text-text-muted mt-0.5">
                  {getPlanStatusLabel(status)} · due {formatShortDate(new Date(plan.date))}
                </span>
              </button>
              <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${statusChip(status)}`}>
                {getPlanStatusLabel(status)}
              </span>
            </li>
          );
        })}
      </ul>
      {longTermGoals.length > 3 && (
        <button
          onClick={() => onNavigateTab('plans')}
          className="mt-auto inline-flex items-center rounded-[10px] bg-surface-hover px-3 py-2 text-[12px] font-medium text-text-secondary hover:text-text transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          View all plans
        </button>
      )}
    </div>
  );
}

function statusChip(status: string): string {
  switch (status) {
    case 'in-progress':
      return 'bg-warning/10 text-warning';
    case 'pending':
      return 'bg-info/10 text-info';
    default:
      return 'bg-surface-hover text-text-muted';
  }
}