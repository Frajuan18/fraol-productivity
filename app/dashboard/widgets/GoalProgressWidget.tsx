'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FiTarget, FiCheck } from 'react-icons/fi';
import { formatMinutesAsHoursMinutes } from '@/src/utils/time';
import { getRepository } from '@/lib/repositories/repository';
import type { PartnerGoalProgress } from '@/lib/repositories/ProductivityRepository';

const GOAL_STORAGE_KEY = 'mywhiteboard-daily-goal';

const COW_IMAGES: Record<string, string> = {
  happy: '/images/happy cow.png',
  sad: '/images/sad cow.png',
  worried: '/images/worried cow.png',
  keepItUp: '/images/keep it up cow.png',
  setGoal: '/images/set goal cow.png',
  noPlanPartner: '/images/no plan partner cow.png',
};

interface DailyGoalData {
  date: string;
  targetMinutes: number;
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function loadGoal(): DailyGoalData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GOAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyGoalData;
  } catch {
    return null;
  }
}

function saveGoal(goal: DailyGoalData) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal));
}

interface GoalProgressProps {
  todayMinutes: number;
}

export default function GoalProgress({ todayMinutes }: GoalProgressProps) {
  const reduced = useReducedMotion();
  const [goal, setGoal] = useState<DailyGoalData | null>(loadGoal());
  const [showSetGoal, setShowSetGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(90);
  const [partnerProgress, setPartnerProgress] = useState<PartnerGoalProgress | null>(null);

  useEffect(() => {
    getRepository()
      .getPartnerGoalWithProgress('')
      .then((data) => setPartnerProgress(data))
      .catch(() => setPartnerProgress(null));
  }, []);

  const today = getTodayString();
  const isGoalForToday = goal?.date === today;
  const targetMinutes = isGoalForToday ? goal.targetMinutes : 0;
  const hasGoal = isGoalForToday && targetMinutes > 0;
  const pct = hasGoal ? Math.min(100, Math.round((todayMinutes / targetMinutes) * 100)) : 0;
  const remaining = hasGoal ? Math.max(0, targetMinutes - todayMinutes) : 0;

  const now = new Date();
  const hour = now.getHours();
  const isDayEnding = hour >= 21;
  const isDayStarted = hour >= 8;
  const minutesLeftInDay = hasGoal ? Math.max(0, (23 - hour) * 60 - now.getMinutes()) : 0;
  const canStillAchieve = hasGoal && remaining > 0 && minutesLeftInDay >= remaining;

  const handleSetGoal = useCallback(() => {
    const newGoal: DailyGoalData = { date: today, targetMinutes: goalInput };
    saveGoal(newGoal);
    setGoal(newGoal);
    setShowSetGoal(false);
    getRepository()
      .setDailyGoal('', today, goalInput)
      .catch(() => {});
  }, [today, goalInput]);

  const getCowImage = (): string => {
    if (!hasGoal) return COW_IMAGES.setGoal;
    if (pct >= 100) return COW_IMAGES.happy;
    if (isDayEnding && !canStillAchieve) return COW_IMAGES.sad;
    if (isDayEnding && canStillAchieve) return COW_IMAGES.worried;
    if (pct >= 50) return COW_IMAGES.happy;
    return COW_IMAGES.keepItUp;
  };

  const getStatusText = (): string => {
    if (!hasGoal) return 'Set a daily focus goal';
    if (pct >= 100) return 'Goal achieved!';
    if (isDayEnding && !canStillAchieve) return 'Not enough time left';
    if (isDayEnding && canStillAchieve) return 'Keep going!';
    if (pct >= 75) return 'Almost there!';
    if (pct >= 50) return 'Keep it up!';
    if (pct >= 25) return 'Good progress';
    if (todayMinutes > 0) return 'Keep focusing!';
    if (isDayStarted) return 'Start your focus session';
    return 'Ready to focus?';
  };

  const cowImage = getCowImage();
  const statusText = getStatusText();

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = hasGoal ? circumference * (1 - pct / 100) : circumference;

  if (!hasGoal && !showSetGoal) {
    return (
      <div className="card-glass rounded-[22px] p-6">
        <div className="flex items-center gap-5">
          <div className="shrink-0 w-32 h-32">
            <img src={COW_IMAGES.setGoal} alt="Set goal" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-medium text-text">Daily Focus Goal</h3>
            <p className="mt-1 text-[13px] text-text-muted">Set a goal to track your daily progress</p>
            <button
              onClick={() => setShowSetGoal(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-accent/10 hover:bg-accent/20 border border-accent/20 px-4 h-9 text-[13px] font-medium text-accent transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <FiTarget size={14} /> Set goal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showSetGoal) {
    return (
      <div className="card-glass rounded-[22px] p-6">
        <h3 className="text-[16px] font-medium text-text mb-4">Set Daily Focus Goal</h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="5"
            max="600"
            value={goalInput}
            onChange={(e) => setGoalInput(Math.max(5, parseInt(e.target.value, 10) || 5))}
            className="w-24 h-10 px-3 bg-surface-hover border border-border rounded-[10px] text-[16px] font-medium text-text text-center outline-none focus:border-border-hover focus:ring-2 focus:ring-focus-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[13px] text-text-muted">minutes</span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setShowSetGoal(false)}
              className="h-9 px-3 rounded-[10px] text-[12px] font-medium bg-surface-hover border border-border text-text-secondary hover:text-text transition-colors duration-150 outline-none"
            >
              Cancel
            </button>
            <button
              onClick={handleSetGoal}
              className="h-9 px-4 rounded-[10px] text-[12px] font-semibold bg-accent hover:bg-accent-hover text-accent-contrast transition-colors duration-150 outline-none"
            >
              Set goal
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {[30, 60, 90, 120, 180].map((m) => (
            <button
              key={m}
              onClick={() => setGoalInput(m)}
              className={`h-8 px-2.5 rounded-lg text-[11px] font-medium tabular-nums transition-colors duration-150 outline-none ${
                goalInput === m
                  ? 'bg-accent text-accent-contrast'
                  : 'bg-surface-hover border border-border text-text-muted hover:text-text'
              }`}
            >
              {m >= 60 ? `${m / 60}h` : `${m}m`}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card-glass rounded-[22px] px-6 py-1.5 sm:py-2">
      <div className="flex flex-col sm:flex-row">
        {/* MY GOAL — LEFT HALF */}
        <div className="flex-1 flex items-center gap-5 pr-0 sm:pr-8 sm:border-r border-white/[0.08]">
          <div className="relative shrink-0 self-center">
            <svg viewBox="0 0 100 100" className="w-[100px] h-[100px] -rotate-90">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-hover)" strokeWidth="6" />
              <motion.circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={pct >= 100 ? 'var(--success)' : 'var(--accent)'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: reduced ? 0 : 0.8, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[22px] font-semibold text-text tabular-nums leading-none">{pct}%</span>
              <span className="mt-0.5 text-[10px] text-text-muted">
                {formatMinutesAsHoursMinutes(todayMinutes)} / {formatMinutesAsHoursMinutes(targetMinutes)}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-[140px] h-[140px]">
                <img src={cowImage} alt={statusText} className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-text">{statusText}</p>
                {hasGoal && remaining > 0 && pct < 100 && (
                  <p className="mt-0.5 text-[12px] text-text-muted">
                    {formatMinutesAsHoursMinutes(remaining)} remaining
                  </p>
                )}
                {pct >= 100 && (
                  <p className="mt-0.5 text-[12px] text-success flex items-center gap-1">
                    <FiCheck size={12} /> Well done!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PARTNER GOAL — RIGHT HALF */}
        <div className="flex-1 flex items-center pl-0 sm:pl-8 pt-6 sm:pt-0">
          {partnerProgress ? (
            <div className="w-full">
              <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-text-muted mb-3">
                {partnerProgress.displayName}&apos;s Goal
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-[20px] font-semibold text-text tabular-nums">{partnerProgress.percentage}%</span>
                <span className="text-[12px] text-text-muted">
                  {formatMinutesAsHoursMinutes(partnerProgress.todayMinutes)} /{' '}
                  {formatMinutesAsHoursMinutes(partnerProgress.targetMinutes)}
                </span>
              </div>
              <div className="relative h-[6px] rounded-full bg-white/[0.12]">
                <motion.div
                  className="absolute top-0 left-0 h-full rounded-full bg-success"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(partnerProgress.percentage, 100)}%` }}
                  transition={{ duration: reduced ? 0 : 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center justify-center py-4">
              <img src={COW_IMAGES.noPlanPartner} alt="No partner goal" className="w-28 h-28 object-contain" />
              <p className="mt-2 text-[12px] text-text-muted text-center">No partner goal set</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
