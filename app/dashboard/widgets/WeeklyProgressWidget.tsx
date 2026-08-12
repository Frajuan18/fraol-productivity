'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FiTrendingUp } from 'react-icons/fi';
import { AnimatedNumber } from '@/src/components/AnimatedNumber';
import { formatMinutesAsHoursMinutes } from '@/src/utils/time';
import type { DashboardWidgetProps } from './types';

export default function WeeklyProgressWidget({ bundle }: DashboardWidgetProps) {
  const reduced = useReducedMotion();
  const { weekDays, weekDisplay, weekChange, weekChangeDisplay, weekCompleted, weekSessionCount, stats } = bundle;

  const weekMax = Math.max(...weekDays.map((d) => d.minutes), 1);

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <div>
          <div className="text-[26px] font-semibold tracking-tight text-text tabular-nums">{weekDisplay}</div>
          <div className="mt-1 text-xs text-text-muted">Focus this week</div>
        </div>
        <div>
          <div
            className={`text-[26px] font-semibold tracking-tight tabular-nums ${weekChange >= 0 ? 'text-success' : 'text-danger'}`}
          >
            {weekChangeDisplay}
          </div>
          <div className="mt-1 text-xs text-text-muted">vs last week</div>
        </div>
        <div>
          <div className="text-[26px] font-semibold tracking-tight text-text tabular-nums">
            <AnimatedNumber value={weekCompleted} />/{weekSessionCount}
          </div>
          <div className="mt-1 text-xs text-text-muted">Completed sessions</div>
        </div>
        <div>
          <div className="text-[26px] font-semibold tracking-tight text-text tabular-nums">
            <AnimatedNumber value={stats.planCompletionRate} />
            <span className="text-[16px]">%</span>
          </div>
          <div className="mt-1 text-xs text-text-muted">Plan completion</div>
        </div>
      </div>

      <div className="mt-6 flex items-end gap-1.5 border-b border-divider/70 h-20">
        {weekDays.map((d, i) => {
          const isToday = i === weekDays.length - 1;
          const barHeight = Math.max(6, (d.minutes / weekMax) * 52);
          const hasData = d.minutes > 0;
          return (
            <div key={d.date} className="group relative flex-1 flex flex-col items-center justify-end h-full">
              <motion.span
                role="img"
                aria-label={`${d.label} — ${d.count} session${d.count !== 1 ? 's' : ''}, ${formatMinutesAsHoursMinutes(d.minutes)} focused`}
                className={`w-full max-w-[20px] rounded-t-[5px] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  isToday
                    ? 'bg-gradient-to-t from-accent to-accent-hover'
                    : hasData
                      ? 'bg-gradient-to-t from-accent/50 to-accent/30'
                      : 'bg-surface-hover'
                }`}
                initial={{ height: 0 }}
                animate={{ height: barHeight }}
                transition={{ duration: reduced ? 0 : 0.4, ease: 'easeOut', delay: reduced ? 0 : i * 0.04 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between px-0.5 mt-1.5">
        {weekDays.map((d, i) => (
          <span
            key={d.date}
            className={`text-[9px] ${i === weekDays.length - 1 ? 'text-accent font-medium' : 'text-text-muted'}`}
          >
            {d.short}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-[12px] text-text-muted">
        <FiTrendingUp size={13} className="text-accent" />
        {weekChange >= 0
          ? 'Ahead of last week — keep the pace.'
          : 'A little behind last week — one session today closes the gap.'}
      </div>
    </div>
  );
}
