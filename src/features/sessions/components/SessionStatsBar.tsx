'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { FiClock, FiCheckCircle, FiActivity, FiXCircle } from 'react-icons/fi';
import { useStatistics } from '@/src/hooks/useStatistics';
import { getWeekStart, parseSessionDate } from '@/src/utils/date';
import type { Session } from '@/src/types';

export type SessionStatusFilter = 'all' | 'completed' | 'in-progress' | 'missed';

interface SessionStatsBarProps {
  sessions: Session[];
  onFilterStatus?: (filter: SessionStatusFilter) => void;
}

export const SessionStatsBar = memo(function SessionStatsBar({ sessions, onFilterStatus }: SessionStatsBarProps) {
  const stats = useStatistics(sessions, []);
  const { sessionCounts, successRate } = stats;
  const weekStart = getWeekStart();
  const thisWeekCount = sessions.filter((s) => {
    const d = parseSessionDate(s.date);
    return d && d >= weekStart;
  }).length;

  const items: {
    label: string;
    value: number;
    icon: React.ComponentType<{ size?: number }>;
    iconClass: string;
    subtitle: string;
    filter: SessionStatusFilter | null;
  }[] = [
    {
      label: 'Total Sessions',
      value: sessionCounts.total,
      icon: FiClock,
      iconClass: 'text-text-muted',
      subtitle: sessionCounts.total > 0 ? `${thisWeekCount} this week` : 'No sessions yet',
      filter: 'all',
    },
    {
      label: 'Completed',
      value: sessionCounts.completed,
      icon: FiCheckCircle,
      iconClass: 'text-success',
      subtitle: sessionCounts.completed > 0 ? `${successRate}% completion` : 'No completions',
      filter: 'completed',
    },
    {
      label: 'In Progress',
      value: sessionCounts.inProgress,
      icon: FiActivity,
      iconClass: 'text-warning',
      subtitle: sessionCounts.inProgress > 0 ? 'Focus in progress' : 'No active session',
      filter: 'in-progress',
    },
    {
      label: 'Missed',
      value: sessionCounts.missed,
      icon: FiXCircle,
      iconClass: 'text-danger',
      subtitle: sessionCounts.missed > 0 ? 'Sessions missed' : 'Nothing missed',
      filter: 'missed',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item, i) => {
        const Icon = item.icon;
        const clickable = item.filter !== null && onFilterStatus;
        return (
          <motion.button
            key={item.label}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            onClick={clickable ? () => onFilterStatus(item.filter!) : undefined}
            disabled={!clickable}
            aria-label={clickable ? `View ${item.label.toLowerCase()} in history` : item.label}
            className={`card-glass rounded-[20px] p-5 text-left relative overflow-hidden transition-all duration-200 ${
              clickable
                ? 'hover:-translate-y-px hover:shadow-[var(--card-shadow-hover)] hover:bg-surface-hover/40 cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring outline-none'
                : 'cursor-default'
            }`}
          >
            <span className="text-xs font-medium text-text-secondary">{item.label}</span>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-[26px] font-semibold tracking-tight text-text tabular-nums leading-none">
                {item.value}
              </span>
              <span className={`${item.iconClass}`}>
                <Icon size={15} />
              </span>
            </div>
            <div className="mt-1.5 text-xs text-text-muted">{item.subtitle}</div>
          </motion.button>
        );
      })}
    </div>
  );
});
