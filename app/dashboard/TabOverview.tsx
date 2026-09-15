'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FiActivity, FiChevronDown } from 'react-icons/fi';
import { useDashboardData } from '@/lib/dashboard/useDashboard';
import { formatLongDate } from '@/src/utils/date';
import type { Session, Plan, PlanStatus } from '@/src/types';
import type { AnalyticsResult } from '@/lib/analytics/types';
import DashboardGrid from './DashboardGrid';
import GoalProgress from './widgets/GoalProgressWidget';

interface TabOverviewProps {
  dailyStats: { focusTime: string; sessions: number; streak: string; productivity: string };
  focusSessions: Session[];
  weeklyStreak: number;
  totalFocusHours: number;
  plansCount: number;
  plans: Plan[];
  user: string | null;
  analytics?: AnalyticsResult | null;
  onUpdatePlanStatus?: (id: number, status: PlanStatus) => void;
  onNavigateTab?: (tab: string) => void;
}

export default function TabOverview({
  focusSessions,
  plans,
  user,
  analytics,
  onUpdatePlanStatus,
  onNavigateTab,
}: TabOverviewProps) {
  const reduced = useReducedMotion();
  const [showWeekly, setShowWeekly] = useState(false);
  const bundle = useDashboardData({ sessions: focusSessions, plans, user, analytics: analytics ?? null });

  const {
    userName,
    greeting,
    todayCount,
    todayCompleted,
    activeSession,
    weekDisplay,
    weekChange,
    weekChangeDisplay,
    weekCompleted,
    weekSessionCount,
  } = bundle;

  const todayDate = new Date();

  const dailySummary = activeSession
    ? 'Your focus session is running — keep going.'
    : todayCount > 0
      ? `You completed ${todayCompleted} session${todayCompleted !== 1 ? 's' : ''} today.`
      : bundle.nextPlan
        ? 'Your next plan is ready.'
        : 'No focus sessions yet today. Start when you are ready.';

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.18, delay: reduced ? 0 : delay },
  });

  return (
    <div className="space-y-6">
      <motion.header {...fade(0)} className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-[640px]">
          <div className="text-[13px] text-text-muted">{formatLongDate(todayDate)}</div>
          <h1 className="mt-1 text-[24px] sm:text-[28px] font-medium leading-[1.15] tracking-[-0.025em] text-text">
            Good {greeting}, {userName}
          </h1>
          <p className="mt-2 text-[15px] text-text-secondary">{dailySummary}</p>
        </div>

        <div className="relative self-start md:self-auto">
          <button
            onClick={() => setShowWeekly((prev) => !prev)}
            aria-expanded={showWeekly}
            aria-haspopup="dialog"
            className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-[13px] text-text-secondary hover:bg-surface-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiActivity size={14} className="text-accent" />
            <span>{weekChangeDisplay} this week</span>
            <FiChevronDown
              size={13}
              className={`transition-transform duration-200 ${showWeekly ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {showWeekly && (
              <>
                <button
                  className="fixed inset-0 z-20 cursor-default"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setShowWeekly(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: reduced ? 0 : 0.15 }}
                  className="absolute right-0 top-full mt-2 z-30 w-64 card-glass rounded-2xl p-4"
                  role="dialog"
                  aria-label="This week summary"
                >
                  <div className="text-[13px] font-medium text-text">This week</div>
                  <dl className="mt-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[13px] text-text-secondary">Focus time</dt>
                      <dd className="text-[13px] font-medium text-text tabular-nums">{weekDisplay}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[13px] text-text-secondary">vs last week</dt>
                      <dd
                        className={`text-[13px] font-medium tabular-nums ${weekChange >= 0 ? 'text-success' : 'text-danger'}`}
                      >
                        {weekChangeDisplay}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[13px] text-text-secondary">Completed</dt>
                      <dd className="text-[13px] font-medium text-text tabular-nums">
                        {weekCompleted}/{weekSessionCount}
                      </dd>
                    </div>
                  </dl>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      <motion.div {...fade(0.05)}>
        <GoalProgress todayMinutes={bundle.todayMinutes} />
      </motion.div>

      <motion.div {...fade(0.1)}>
        <DashboardGrid
          bundle={bundle}
          onNavigateTab={(tab) => onNavigateTab?.(tab)}
          onUpdatePlanStatus={onUpdatePlanStatus}
        />
      </motion.div>
    </div>
  );
}
