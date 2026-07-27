'use client';

import { memo } from 'react';
import { FiCalendar } from 'react-icons/fi';
import { motion } from 'framer-motion';
import type { Plan } from '@/src/types';
import {
  getPlanStatusBadgeClass,
  getPlanStatusLabel,
  getPlanPriorityBadgeClass,
  getPlanPriorityLabel,
} from '@/src/utils/badges';
import { Badge } from '@/src/components/ui/Badge';

interface PlanHistoryItemProps {
  plan: Plan;
}

export const PlanHistoryItem = memo(function PlanHistoryItem({ plan }: PlanHistoryItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-3 bg-surface-hover rounded-xl border border-border hover:bg-surface-hover transition-all"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border ${getPlanStatusBadgeClass(plan.status)}`}
        >
          <StatusIcon status={plan.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text truncate">{plan.title}</div>
          <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
            <span className="flex items-center gap-1">
              <FiCalendar size={10} /> {plan.date}
            </span>
            <Badge className={getPlanPriorityBadgeClass(plan.priority)}>{getPlanPriorityLabel(plan.priority)}</Badge>
            <Badge className="bg-surface-hover border border-border-hover text-text-secondary">{plan.type}</Badge>
          </div>
        </div>
      </div>
      <Badge className={getPlanStatusBadgeClass(plan.status)}>{getPlanStatusLabel(plan.status)}</Badge>
    </motion.div>
  );
});

function StatusIcon({ status }: { status: Plan['status'] }) {
  const icons: Record<string, React.ReactNode> = {
    completed: <CheckIcon />,
    'in-progress': <RefreshIcon />,
    pending: <ClockIcon />,
    'not-started': <XIcon />,
  };
  return <>{icons[status] || <ClockIcon />}</>;
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-success"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-warning"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-info"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-text-secondary"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
