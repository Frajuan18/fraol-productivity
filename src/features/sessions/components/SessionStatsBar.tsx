'use client';

import { memo } from 'react';
import { FiClock, FiCheckCircle, FiActivity, FiXCircle } from 'react-icons/fi';
import { useStatistics } from '@/src/hooks/useStatistics';
import type { Session } from '@/src/types';

interface SessionStatsBarProps {
  sessions: Session[];
}

export const SessionStatsBar = memo(function SessionStatsBar({ sessions }: SessionStatsBarProps) {
  const stats = useStatistics(sessions, []);
  const { sessionCounts } = stats;

  const items = [
    { label: 'Total Sessions', value: sessionCounts.total, icon: FiClock, color: 'text-text-secondary' },
    { label: 'Completed', value: sessionCounts.completed, icon: FiCheckCircle, color: 'text-success' },
    { label: 'In Progress', value: sessionCounts.inProgress, icon: FiActivity, color: 'text-warning' },
    { label: 'Missed', value: sessionCounts.missed, icon: FiXCircle, color: 'text-danger' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="bg-surface rounded-2xl p-4 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-xs uppercase tracking-wider">{item.label}</span>
              <Icon className={item.color} size={16} />
            </div>
            <div className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</div>
          </div>
        );
      })}
    </div>
  );
});
