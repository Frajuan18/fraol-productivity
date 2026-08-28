'use client';

import { FiPieChart } from 'react-icons/fi';
import type { DashboardWidgetProps } from './types';

const BAR_COLORS = [
  'bg-accent',
  'bg-[#6C63FF]',
  'bg-[#FF6B6B]',
  'bg-[#4ECDC4]',
  'bg-[#FFD93D]',
  'bg-[#95E1D3]',
  'bg-[#F38181]',
  'bg-[#AA96DA]',
];

export default function FocusDistributionWidget({ bundle }: DashboardWidgetProps) {
  const { focusDistribution } = bundle;

  if (focusDistribution.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-hover">
          <FiPieChart className="text-text-muted" size={18} />
        </div>
        <p className="mt-3 text-[14px] text-text-secondary">No focus data yet.</p>
        <p className="mt-0.5 text-[12px] text-text-muted">Complete a session to see your task distribution.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {focusDistribution.map((item, i) => (
        <div key={item.task} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-[13px] text-text-secondary" title={item.task}>
            {item.task}
          </span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-[12px] font-medium text-text tabular-nums">
            {item.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
}
