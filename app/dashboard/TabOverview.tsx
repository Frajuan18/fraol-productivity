'use client';

import { useMemo } from 'react';
import { FiTarget, FiClock, FiTrendingUp, FiCalendar, FiCheckCircle, FiZap } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { StatCard } from '@/src/components/ui/StatCard';
import { MiniCalendar } from '@/src/features/sessions/components/MiniCalendar';
import { useStatistics } from '@/src/hooks/useStatistics';
import { sumSessionMinutes, formatMinutesAsHoursMinutes } from '@/src/utils/time';
import { focusMinutesThisWeek, focusMinutesLastWeek, sessionsOnDate } from '@/src/utils/statistics';
import { formatShortDate } from '@/src/utils/date';
import type { Session, Plan } from '@/src/types';

interface TabOverviewProps {
  dailyStats: { focusTime: string; sessions: number; streak: string; productivity: string };
  focusSessions: Session[];
  weeklyStreak: number;
  totalFocusHours: number;
  plansCount: number;
}

export default function TabOverview({ focusSessions, plansCount }: TabOverviewProps) {
  const stats = useStatistics(focusSessions, []);
  const totalMinutes = sumSessionMinutes(focusSessions);
  const displayTime = formatMinutesAsHoursMinutes(totalMinutes);

  const weeklyMinutes = focusMinutesThisWeek(focusSessions);
  const weeklyDisplay = formatMinutesAsHoursMinutes(weeklyMinutes);

  const weeklyChange = useMemo(() => {
    const thisWeek = focusMinutesThisWeek(focusSessions);
    const lastWeek = focusMinutesLastWeek(focusSessions);
    if (lastWeek === 0 && thisWeek === 0) return { change: 0, display: '0%' };
    if (lastWeek === 0) return { change: 100, display: '+100%' };
    const change = ((thisWeek - lastWeek) / lastWeek) * 100;
    const rounded = Math.round(change);
    return { change: rounded, display: rounded > 0 ? `+${rounded}%` : `${rounded}%` };
  }, [focusSessions]);

  const todayStr = formatShortDate(new Date());
  const todaySessions = focusSessions.filter((s) => s.date === todayStr);
  const todayMinutes = sumSessionMinutes(todaySessions);
  const todayDisplay = formatMinutesAsHoursMinutes(todayMinutes);
  const todayCount = todaySessions.length;

  const completedCount = stats.sessionCounts.completed;
  const totalSessions = stats.sessionCounts.total;

  const recentSessions = focusSessions.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Plans"
          value={plansCount}
          delay={0.05}
          icon={<FiTarget className="text-info" size={18} />}
          trend={{ value: 'Active today', isPositive: true }}
        />
        <StatCard
          label="Sessions"
          value={totalSessions}
          delay={0.1}
          icon={<FiClock className="text-accent" size={18} />}
          trend={{ value: `${completedCount} completed`, isPositive: true }}
        />
        <StatCard
          label="Streak"
          value={`${stats.streak} days`}
          delay={0.15}
          icon={<FiTrendingUp className="text-warning" size={18} />}
          trend={{ value: stats.streak > 0 ? 'Keep it going!' : 'Start today!', isPositive: stats.streak > 0 }}
        />
        <StatCard
          label="Focus Hours"
          value={displayTime}
          delay={0.2}
          icon={<FiZap className="text-success" size={18} />}
          trend={{ value: `${weeklyChange.display} this week`, isPositive: weeklyChange.change >= 0 }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="bg-surface rounded-2xl p-6 border border-border"
        >
          <div className="flex items-center gap-3 mb-4">
            <FiCalendar className="text-text-secondary" size={18} />
            <h3 className="text-sm font-medium text-text">Recent Sessions</h3>
          </div>
          <div className="space-y-3">
            {recentSessions.length === 0 ? (
              <div className="text-center py-6 text-text-muted text-sm">No sessions yet. Start your first session!</div>
            ) : (
              recentSessions.map((session, index) => (
                <div
                  key={session.id || index}
                  className="flex items-center justify-between p-3 bg-surface-hover rounded-xl border border-border"
                >
                  <div>
                    <div className="text-sm font-medium text-text">{session.task}</div>
                    <div className="text-xs text-text-secondary">
                      {session.duration} &bull; {session.date}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      session.status === 'Completed'
                        ? 'bg-success-muted text-success'
                        : session.status === 'In Progress'
                          ? 'bg-warning-muted text-warning'
                          : 'bg-danger-muted text-danger'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>
              ))
            )}
            {focusSessions.length > 3 && (
              <div className="text-center text-xs text-text-muted pt-1">+{focusSessions.length - 3} more sessions</div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-surface rounded-2xl p-6 border border-border"
        >
          <div className="flex items-center gap-3 mb-4">
            <FiCheckCircle className="text-text-secondary" size={18} />
            <h3 className="text-sm font-medium text-text">Today&apos;s Summary</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-xl border border-border">
              <span className="text-sm text-text-secondary">Focus Time Today</span>
              <span className="text-sm font-medium text-text">{todayDisplay}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-xl border border-border">
              <span className="text-sm text-text-secondary">Sessions Today</span>
              <span className="text-sm font-medium text-text">{todayCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-xl border border-border">
              <span className="text-sm text-text-secondary">Total Focus Hours</span>
              <span className="text-sm font-medium text-text">{displayTime}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-hover rounded-xl border border-border">
              <span className="text-sm text-text-secondary">Weekly Change</span>
              <span className={`text-sm font-medium ${weeklyChange.change >= 0 ? 'text-success' : 'text-danger'}`}>
                {weeklyChange.display}
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="lg:self-start"
        >
          <MiniCalendar sessions={focusSessions} />
        </motion.div>
      </div>
    </div>
  );
}
