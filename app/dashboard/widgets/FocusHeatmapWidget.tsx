'use client';

import { formatMinutesAsHoursMinutes } from '@/src/utils/time';
import type { DashboardWidgetProps } from './types';

const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-surface-hover',
  1: 'bg-accent/15',
  2: 'bg-accent/30',
  3: 'bg-accent/50',
  4: 'bg-accent',
};

export default function FocusHeatmapWidget({ bundle }: DashboardWidgetProps) {
  const { heatmap } = bundle;
  const hasAny = heatmap.some((cell) => cell.minutes > 0);

  return (
    <div className="flex h-full flex-col">
      {hasAny ? (
        <p className="text-[12px] text-text-muted">Last 30 days of focus — darker means more.</p>
      ) : (
        <p className="text-[12px] text-text-muted">No focus recorded in the last 30 days yet.</p>
      )}

      <div className="mt-3 grid grid-cols-10 gap-1.5" role="img" aria-label="Focus heatmap for the last 30 days">
        {heatmap.map((cell) => (
          <div
            key={cell.iso}
            role="gridcell"
            className={`aspect-square rounded-[4px] ${LEVEL_CLASS[cell.level]} transition-colors duration-150`}
            title={`${cell.iso} — ${cell.minutes > 0 ? formatMinutesAsHoursMinutes(cell.minutes) : 'no focus'}`}
            aria-label={`${cell.iso}: ${cell.minutes > 0 ? formatMinutesAsHoursMinutes(cell.minutes) : 'no focus'}`}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-text-muted">
        <span>30 days ago</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <span className={`h-2.5 w-2.5 rounded-[3px] ${LEVEL_CLASS[0]}`} />
          <span className={`h-2.5 w-2.5 rounded-[3px] ${LEVEL_CLASS[1]}`} />
          <span className={`h-2.5 w-2.5 rounded-[3px] ${LEVEL_CLASS[2]}`} />
          <span className={`h-2.5 w-2.5 rounded-[3px] ${LEVEL_CLASS[3]}`} />
          <span className={`h-2.5 w-2.5 rounded-[3px] ${LEVEL_CLASS[4]}`} />
          <span>More</span>
        </div>
        <span>Today</span>
      </div>
    </div>
  );
}
