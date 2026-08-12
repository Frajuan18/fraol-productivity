'use client';

import { useState } from 'react';
import { memo } from 'react';
import {
  FiMoreHorizontal,
  FiCheckCircle,
  FiRefreshCw,
  FiClock,
  FiCalendar,
  FiArrowRight,
  FiTrash2,
  FiTarget,
  FiBookOpen,
  FiBriefcase,
  FiUser,
  FiFolder,
  FiSliders,
} from 'react-icons/fi';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { IconType } from 'react-icons';
import type { Plan, PlanPriority, PlanStatus } from '@/src/types';
import { Badge } from '@/src/components/ui/Badge';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { parseStudyPlanText } from '@/app/dashboard/plans/studySchedule';
import { toIsoDateString } from '@/src/utils/date';

interface PlanCardProps {
  plan: Plan;
  onUpdateStatus: (id: number, status: PlanStatus) => void;
  onDelete: (id: number) => void;
  onOpen?: (plan: Plan) => void;
}

const CATEGORY_ICONS: Record<string, IconType> = {
  Study: FiBookOpen,
  Work: FiBriefcase,
  Personal: FiUser,
  Project: FiFolder,
  Custom: FiSliders,
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
  pending: 'Pending',
  'not-started': 'Not started',
};

function statusBadgeClass(status: PlanStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-success/10 text-success border-success/15';
    case 'in-progress':
      return 'bg-accent-muted text-accent border-accent/25';
    case 'pending':
      return 'bg-warning/10 text-warning border-warning/20';
    default:
      return 'bg-surface-hover text-text-muted border-border';
  }
}

function priorityBadgeClass(priority: PlanPriority): string {
  if (priority === 'high') return 'bg-danger/10 text-danger border-danger/15';
  return 'bg-surface-hover text-text-secondary border-border';
}

function priorityLabel(priority: PlanPriority): string {
  if (priority === 'high') return 'High priority';
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function cleanDescription(description: string): string {
  const lines = description.split('\n');
  const end = lines.findIndex((l) => /^(Sessions:|Steps:|Schedule:|Frequency:)/.test(l.trim()));
  return (end === -1 ? lines : lines.slice(0, end)).join('\n').trim();
}

function formatDue(iso: string): string {
  if (iso === toIsoDateString(new Date())) return 'Today';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function planProgress(plan: Plan): { pct: number; done: number; total: number; minutes: number } {
  const sessions = parseStudyPlanText(plan.description);
  if (sessions && sessions.length > 0) {
    const done = sessions.filter((s) => s.done).length;
    return {
      pct: Math.round((done / sessions.length) * 100),
      done,
      total: sessions.length,
      minutes: sessions.reduce((acc, s) => acc + s.minutes, 0),
    };
  }
  const stepsMatch = plan.description.match(/^Steps:\n([\s\S]*)/m);
  if (stepsMatch) {
    const steps = stepsMatch[1].split('\n').filter((l) => /^\d+\.\s/.test(l.trim()));
    return { pct: 0, done: 0, total: steps.length, minutes: 0 };
  }
  return { pct: plan.status === 'completed' ? 100 : 0, done: 0, total: 0, minutes: 0 };
}

export const PlanCard = memo(function PlanCard({ plan, onUpdateStatus, onDelete, onOpen }: PlanCardProps) {
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  const { pct, done, total, minutes } = planProgress(plan);
  const CatIcon = CATEGORY_ICONS[plan.category] ?? FiTarget;

  const summary = (() => {
    const clean = cleanDescription(plan.description);
    if (clean) return clean;
    if (total > 0) {
      return `Work through the uploaded material and complete ${total} focused step${total !== 1 ? 's' : ''}.`;
    }
    return 'Break the work into focused steps and track your progress.';
  })();

  const closeMenu = () => setMenuOpen(false);

  const menuActions: { label: string; icon: IconType; cls: string; fn: () => void }[] = [
    ...(plan.status !== 'completed'
      ? [
          {
            label: 'Mark complete',
            icon: FiCheckCircle,
            cls: 'text-success hover:bg-success/10',
            fn: () => onUpdateStatus(plan.id, 'completed'),
          },
        ]
      : []),
    ...(plan.status !== 'in-progress' && plan.status !== 'completed'
      ? [
          {
            label: 'Start progress',
            icon: FiRefreshCw,
            cls: 'text-warning hover:bg-warning/10',
            fn: () => onUpdateStatus(plan.id, 'in-progress'),
          },
        ]
      : []),
    ...(plan.status !== 'pending'
      ? [
          {
            label: 'Set pending',
            icon: FiClock,
            cls: 'text-info hover:bg-info/10',
            fn: () => onUpdateStatus(plan.id, 'pending'),
          },
        ]
      : []),
    { label: 'Delete', icon: FiTrash2, cls: 'text-danger hover:bg-danger/10', fn: () => onDelete(plan.id) },
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen ? () => onOpen(plan) : undefined}
      className={`group relative flex flex-col bg-surface rounded-[16px] border border-border p-4 transition-all duration-200 ${
        onOpen
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-border-hover hover:bg-surface-hover/40 hover:shadow-[0_10px_28px_rgba(0,0,0,0.22)]'
          : ''
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-[10px] bg-accent-muted flex items-center justify-center shrink-0">
            <CatIcon size={15} className="text-accent" />
          </span>
          <h4 className="text-[14px] font-semibold tracking-[-0.01em] text-text truncate">{plan.title}</h4>
        </div>
        <div className="relative shrink-0 -mr-1 -mt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for ${plan.title}`}
            title="Plan actions"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiMoreHorizontal size={16} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeMenu();
                  }}
                  aria-hidden="true"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -2 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -2 }}
                  transition={{ duration: reduced ? 0 : 0.14, ease: 'easeOut' }}
                  role="menu"
                  className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-border bg-surface-raised shadow-[var(--card-shadow-hover)] p-1"
                >
                  {menuActions.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <button
                        key={action.label}
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeMenu();
                          action.fn();
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${action.cls}`}
                      >
                        <ActionIcon size={14} />
                        {action.label}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Status row */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge className={statusBadgeClass(plan.status)}>{STATUS_LABELS[plan.status]}</Badge>
        <Badge className={priorityBadgeClass(plan.priority)}>{priorityLabel(plan.priority)}</Badge>
      </div>

      {/* Description */}
      <p className="mt-2.5 text-[13px] leading-[1.6] text-text-secondary line-clamp-2">{summary}</p>

      {/* Progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-muted">Progress</span>
          <span className="text-text-secondary font-medium tabular-nums">{pct}%</span>
        </div>
        <ProgressBar value={pct} className="mt-1.5 h-1.5" />
        {total > 0 && (
          <div className="mt-1.5 text-[11px] text-text-muted tabular-nums">
            {done} of {total} steps completed
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-3.5 flex items-center gap-3 text-[11px] text-text-muted">
        {minutes > 0 && (
          <span className="inline-flex items-center gap-1">
            <FiClock size={11} className="text-text-muted" /> {formatMinutes(minutes)} planned
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <FiCalendar size={11} className="text-text-muted" /> Due {formatDue(plan.date)}
        </span>
        {plan.category && (
          <span className="ml-auto inline-flex items-center rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-text-secondary">
            {plan.category}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3.5 pt-3 border-t border-divider">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.(plan);
          }}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg"
        >
          Open plan
          <FiArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>
    </motion.div>
  );
});
