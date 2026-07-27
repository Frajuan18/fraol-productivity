'use client';

import { motion } from 'framer-motion';
import { useStatistics } from '@/src/hooks/useStatistics';
import { sumSessionMinutes } from '@/src/utils/time';
import { formatMinutesAsHoursMinutes } from '@/src/utils/time';
import { useEffect, useState } from 'react';
import { dataService } from '@/lib/dataService';
import type { Session } from '@/src/types';

export function LandingStats() {
  const [sessions, setSessions] = useState<Session[]>([]);

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

  const statItems = [
    { label: 'Sessions', value: stats.sessionCounts.total, delay: 0.1 },
    { label: 'Focus Time', value: formatMinutesAsHoursMinutes(totalMinutes), delay: 0.15 },
    { label: 'Streak', value: `${stats.streak}d`, delay: 0.2 },
    { label: 'Productivity', value: `${stats.successRate}%`, delay: 0.25 },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
      {statItems.map((item) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: item.delay }}
          className="bg-surface/60 backdrop-blur-md rounded-xl p-4 border border-border"
        >
          <div className="text-[10px] text-text-muted uppercase tracking-wider">{item.label}</div>
          <div className="text-2xl font-bold text-text mt-1">{item.value}</div>
        </motion.div>
      ))}
    </div>
  );
}
