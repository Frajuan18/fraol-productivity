'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FiClock, FiWatch, FiActivity, FiTrendingUp } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useStatistics } from '@/src/hooks/useStatistics';
import { sumSessionMinutes } from '@/src/utils/time';
import { formatMinutesAsHoursMinutes } from '@/src/utils/time';
import { useEffect, useState } from 'react';
import { dataService } from '@/lib/dataService';
import type { Session } from '@/src/types';

interface StatItem {
  label: string;
  value: string;
  icon: IconType;
  tooltip: string;
  detail: string;
}

export function LandingStats() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    dataService
      .loadData()
      .then((data) => {
        setSessions(data.sessions || []);
      })
      .catch(() => {});
  }, []);

  const stats = useStatistics(sessions, []);
  const totalMinutes = sumSessionMinutes(sessions);

  const statItems: StatItem[] = [
    {
      label: 'Sessions',
      value: String(stats.sessionCounts.total),
      icon: FiClock,
      tooltip: 'Total focus sessions recorded',
      detail: 'Total sessions',
    },
    {
      label: 'Focus time',
      value: formatMinutesAsHoursMinutes(totalMinutes),
      icon: FiWatch,
      tooltip: 'Total time spent in focus sessions',
      detail: 'Total focused time',
    },
    {
      label: 'Streak',
      value: `${stats.streak} day${stats.streak === 1 ? '' : 's'}`,
      icon: FiActivity,
      tooltip: 'Consecutive days with a completed session',
      detail: 'Keep it going',
    },
    {
      label: 'Productivity',
      value: `${stats.successRate}%`,
      icon: FiTrendingUp,
      tooltip: 'Share of sessions completed',
      detail: 'Based on completed sessions',
    },
  ];

  return (
    <section aria-label="Today's statistics">
      <h2 className="text-[18px] font-semibold tracking-tight text-[#F2F3F5] lg:text-[20px]">Today</h2>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {statItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              title={item.tooltip}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : 0.1 + index * 0.06, ease: 'easeOut' }}
              className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#1B1D22] p-4 transition-colors duration-150 hover:border-[rgba(255,255,255,0.16)] hover:bg-[#1E2026] sm:p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#777D87]">{item.label}</span>
                <Icon size={14} className="text-[#777D87]" aria-hidden="true" />
              </div>
              <div>
                <div className="text-[26px] font-semibold leading-none tracking-tight text-[#F2F3F5] tabular-nums lg:text-[28px]">
                  {item.value}
                </div>
                <div className="mt-1.5 text-xs text-[#777D87]">{item.detail}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
