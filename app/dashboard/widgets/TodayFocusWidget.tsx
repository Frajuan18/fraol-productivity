'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FiClock } from 'react-icons/fi';
import { AnimatedNumber } from '@/src/components/AnimatedNumber';
import type { DashboardWidgetProps } from './types';

export default function TodayFocusWidget({ bundle }: DashboardWidgetProps) {
  const reduced = useReducedMotion();
  const { todayMinutes, todayDisplay, todayCount, todayCompleted, goalMinutes, goalSource, stats, consistencyScore } = bundle;

  const pct = goalMinutes > 0 ? Math.min(100, (todayMinutes / goalMinutes) * 100) : 0;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-center pt-1">
        <div className="relative h-40 w-40">
          <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90">
            <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--surface-hover)" strokeWidth="11" />
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: reduced ? 0 : 0.6, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <motion.span
              className="text-[30px] font-semibold tracking-tight text-text tabular-nums leading-none"
              key={todayDisplay}
              initial={reduced ? false : { opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
            >
              {todayDisplay}
            </motion.span>
            <span className="mt-1 text-[11px] text-text-muted">of {formatGoal(goalMinutes)}</span>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-text-secondary">
          {todayCount} session{todayCount !== 1 ? 's' : ''} · {todayCompleted} completed
        </p>
        {goalSource === 'signals' && (
          <p className="mt-0.5 text-[11px] text-text-muted">Goal based on your focus history</p>
        )}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-3 pt-5">
        <div className="rounded-xl bg-surface-hover/50 px-3 py-2.5 text-center">
          <div className="text-lg font-semibold text-text tabular-nums">
            <AnimatedNumber value={todayCount} />
          </div>
          <div className="mt-0.5 text-[11px] text-text-muted">Sessions</div>
        </div>
        <div className="rounded-xl bg-surface-hover/50 px-3 py-2.5 text-center">
          <div className="text-lg font-semibold text-text tabular-nums">
            <AnimatedNumber value={stats.streak} />
          </div>
          <div className="mt-0.5 text-[11px] text-text-muted">Streak</div>
        </div>
        <div className="rounded-xl bg-surface-hover/50 px-3 py-2.5 text-center">
          <div className="text-lg font-semibold text-text tabular-nums">
            <AnimatedNumber value={consistencyScore} />
          </div>
          <div className="mt-0.5 text-[11px] text-text-muted">Consistency</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-text-muted">
        <FiClock size={12} className="text-accent" />
        Progress toward your daily focus goal
      </div>
    </div>
  );
}

function formatGoal(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}