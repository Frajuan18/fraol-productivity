'use client';

import { useMemo } from 'react';
import {
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiBarChart2,
  FiTarget,
  FiAward,
  FiCheckCircle,
  FiXCircle,
  FiCalendar,
  FiZap,
} from 'react-icons/fi';
import { FaFire } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { useStatistics } from '@/src/hooks/useStatistics';
import { sumSessionMinutes, formatMinutesAsHoursMinutes } from '@/src/utils/time';
import { StatCard } from '@/src/components/ui/StatCard';
import { formatShortDate, getWeekStart } from '@/src/utils/date';
import type { Session, Plan } from '@/src/types';

interface TabStatsProps {
  dailyStats: { focusTime: string; sessions: number; streak: string; productivity: string };
  weeklyStreak: number;
  totalFocusHours: number;
  sessions?: Session[];
  plans?: Plan[];
}

export default function TabStats({ sessions = [], plans = [] }: TabStatsProps) {
  const stats = useStatistics(sessions, plans);
  const { sessionCounts, planCounts, successRate, streak, planCompletionRate } = stats;
  const totalMinutes = sumSessionMinutes(sessions);
  const displayTime = formatMinutesAsHoursMinutes(totalMinutes);

  const todayStr = formatShortDate(new Date());
  const todayMinutes = sumSessionMinutes(sessions.filter((s) => s.date === todayStr));
  const todayDisplay = formatMinutesAsHoursMinutes(todayMinutes);

  const weeklyData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekStart = getWeekStart();
    return days.map((day, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const dateStr = formatShortDate(date);
      const daySessions = sessions.filter((s) => s.date === dateStr);
      const completed = daySessions.filter((s) => s.status === 'Completed').length;
      const total = daySessions.length;
      return { day, completed, total, value: total > 0 ? Math.round((completed / total) * 100) : 0 };
    });
  }, [sessions]);

  const totalWeeklySessions = weeklyData.reduce((acc, d) => acc + d.total, 0);
  const completedWeeklySessions = weeklyData.reduce((acc, d) => acc + d.completed, 0);

  const trendRate = totalWeeklySessions > 0 ? Math.round((completedWeeklySessions / totalWeeklySessions) * 100) : 0;
  const trend = trendRate > 50 ? 'up' : trendRate > 30 ? 'stable' : 'down';

  const avgSessionMin = sessionCounts.total > 0 ? Math.round(totalMinutes / sessionCounts.total) : 0;
  const bestDay = weeklyData.reduce((a, b) => (a.total > b.total ? a : b), weeklyData[0]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sessions"
          value={sessionCounts.total}
          delay={0}
          icon={<FiClock className="text-text-secondary" size={18} />}
          trend={{ value: `${totalWeeklySessions} this week`, isPositive: true }}
        />
        <StatCard
          label="Completed"
          value={sessionCounts.completed}
          delay={0.05}
          icon={<FiCheckCircle className="text-success" size={18} />}
          trend={{ value: `${successRate}% success rate`, isPositive: true }}
        />
        <StatCard
          label="In Progress"
          value={sessionCounts.inProgress}
          delay={0.1}
          icon={<FiActivity className="text-warning" size={18} />}
          trend={{ value: 'Currently active', isPositive: true }}
        />
        <StatCard
          label="Missed"
          value={sessionCounts.missed}
          delay={0.15}
          icon={<FiXCircle className="text-danger" size={18} />}
          trend={{ value: 'Needs attention', isPositive: false }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-surface rounded-2xl p-6 border border-border"
        >
          <div className="flex items-center gap-3 mb-2">
            <FiClock className="text-text-secondary" size={20} />
            <h3 className="text-sm font-medium text-text-secondary">Total Focus Time</h3>
          </div>
          <div className="text-3xl lg:text-4xl font-bold text-text">{displayTime}</div>
          <div className="flex items-center gap-2 mt-2 text-sm text-success">
            <FiTrendingUp size={16} />
            <span>Based on {sessionCounts.total} sessions</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border text-xs text-text-muted">Today: {todayDisplay}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="bg-surface rounded-2xl p-6 border border-border"
        >
          <div className="flex items-center gap-3 mb-2">
            <FiAward className="text-text-secondary" size={20} />
            <h3 className="text-sm font-medium text-text-secondary">Streak</h3>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-3xl lg:text-4xl font-bold text-text">{streak}</div>
            <div className="text-sm text-text-secondary mb-1">days</div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            {streak > 0 ? (
              <span className="text-warning flex items-center gap-1">
                <FaFire size={14} /> Keep going!
              </span>
            ) : (
              <span className="text-text-secondary">Start a session to build your streak</span>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-surface rounded-2xl p-6 border border-border"
        >
          <div className="flex items-center gap-3 mb-2">
            <FiBarChart2 className="text-text-secondary" size={20} />
            <h3 className="text-sm font-medium text-text-secondary">Productivity</h3>
          </div>
          <div className="text-3xl lg:text-4xl font-bold text-success">{successRate}%</div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            {trend === 'up' ? (
              <span className="text-success flex items-center gap-1">
                <FiTrendingUp size={14} /> &uarr; {trendRate}% completion
              </span>
            ) : trend === 'down' ? (
              <span className="text-danger flex items-center gap-1">
                <FiTrendingDown size={14} /> &darr; {trendRate}% completion
              </span>
            ) : (
              <span className="text-text-secondary">No sessions yet</span>
            )}
          </div>
        </motion.div>
      </div>

      {planCounts.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="bg-surface rounded-2xl p-6 border border-border"
        >
          <div className="flex items-center gap-3 mb-4">
            <FiCalendar className="text-text-secondary" size={20} />
            <h3 className="text-sm font-medium text-text-secondary">Plans Overview</h3>
            <span className="text-xs text-text-muted">({planCounts.total} total)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-surface-hover rounded-xl">
              <div className="text-xs text-text-secondary">Completed</div>
              <div className="text-xl font-bold text-success">{planCounts.completed}</div>
            </div>
            <div className="text-center p-3 bg-surface-hover rounded-xl">
              <div className="text-xs text-text-secondary">In Progress</div>
              <div className="text-xl font-bold text-warning">{planCounts.inProgress}</div>
            </div>
            <div className="text-center p-3 bg-surface-hover rounded-xl">
              <div className="text-xs text-text-secondary">Pending</div>
              <div className="text-xl font-bold text-info">{planCounts.pending}</div>
            </div>
            <div className="text-center p-3 bg-surface-hover rounded-xl">
              <div className="text-xs text-text-secondary">Not Started</div>
              <div className="text-xl font-bold text-text-secondary">{planCounts.notStarted}</div>
            </div>
          </div>
        </motion.div>
      )}

      {totalWeeklySessions > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="bg-surface rounded-2xl p-6 border border-border"
          >
            <h3 className="text-sm font-medium text-text-secondary mb-6 flex items-center gap-2">
              <FiBarChart2 size={16} /> Weekly Overview
            </h3>
            <div className="h-64 flex items-end justify-between gap-2">
              {weeklyData.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-gray-600 to-gray-400 rounded-lg transition-all hover:opacity-80"
                      style={{ height: `${Math.max(day.value, 5)}%` }}
                    />
                    {day.total > 0 && (
                      <div className="absolute -top-5 text-[10px] text-white/60">
                        {day.completed}/{day.total}
                      </div>
                    )}
                  </div>
                  <span className="text-text-muted text-[10px]">{day.day}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between text-xs">
              <span className="text-text-secondary">Total sessions this week</span>
              <span className="text-text font-medium">{totalWeeklySessions}</span>
            </div>
          </motion.div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.45 }}
              className="bg-surface rounded-2xl p-6 border border-border"
            >
              <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
                <FiTarget size={16} /> Quick Stats
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-hover rounded-xl p-3 text-center">
                  <div className="text-xs text-text-secondary">Avg Session</div>
                  <div className="text-lg font-bold text-text">{avgSessionMin}m</div>
                </div>
                <div className="bg-surface-hover rounded-xl p-3 text-center">
                  <div className="text-xs text-text-secondary">Best Day</div>
                  <div className="text-lg font-bold text-text">{bestDay?.day || 'N/A'}</div>
                </div>
                <div className="bg-surface-hover rounded-xl p-3 text-center">
                  <div className="text-xs text-text-secondary">Completion</div>
                  <div className="text-lg font-bold text-success">{successRate}%</div>
                </div>
                <div className="bg-surface-hover rounded-xl p-3 text-center">
                  <div className="text-xs text-text-secondary">Plans Done</div>
                  <div className="text-lg font-bold text-text">{planCompletionRate}%</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
