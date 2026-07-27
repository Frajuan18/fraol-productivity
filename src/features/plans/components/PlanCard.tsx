'use client';

import { memo } from 'react';
import { FiCheckCircle, FiRefreshCw, FiClock, FiXCircle } from 'react-icons/fi';
import { motion } from 'framer-motion';
import type { Plan, PlanStatus } from '@/src/types';
import {
  getPlanStatusBadgeClass,
  getPlanStatusLabel,
  getPlanPriorityBadgeClass,
  getPlanPriorityLabel,
} from '@/src/utils/badges';
import { Badge } from '@/src/components/ui/Badge';

interface PlanCardProps {
  plan: Plan;
  onUpdateStatus: (id: number, status: PlanStatus) => void;
  onDelete: (id: number) => void;
}

export const PlanCard = memo(function PlanCard({ plan, onUpdateStatus, onDelete }: PlanCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-2xl p-4 border border-border hover:border-border-hover transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={getPlanStatusBadgeClass(plan.status)}>{getPlanStatusLabel(plan.status)}</Badge>
            <h4 className="text-sm font-medium text-text">{plan.title}</h4>
            <Badge className={getPlanPriorityBadgeClass(plan.priority)}>{getPlanPriorityLabel(plan.priority)}</Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1 ml-1">{plan.description}</p>
          <div className="flex items-center gap-3 mt-2 ml-1 flex-wrap">
            <Badge className="bg-surface-hover border border-border-hover text-text-secondary">{plan.type}</Badge>
            <Badge className="bg-surface-hover border border-border-hover text-text-secondary">{plan.category}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan.status !== 'completed' && (
            <button
              onClick={() => onUpdateStatus(plan.id, 'completed')}
              className="p-1.5 text-success hover:bg-success-muted rounded-lg transition-all"
              title="Complete"
              aria-label="Mark plan as complete"
            >
              <FiCheckCircle size={16} />
            </button>
          )}
          {plan.status !== 'in-progress' && plan.status !== 'completed' && (
            <button
              onClick={() => onUpdateStatus(plan.id, 'in-progress')}
              className="p-1.5 text-warning hover:bg-warning-muted rounded-lg transition-all"
              title="Start Progress"
              aria-label="Start plan progress"
            >
              <FiRefreshCw size={16} />
            </button>
          )}
          {plan.status === 'not-started' && (
            <button
              onClick={() => onUpdateStatus(plan.id, 'pending')}
              className="p-1.5 text-info hover:bg-accent-muted rounded-lg transition-all"
              title="Set Pending"
              aria-label="Set plan as pending"
            >
              <FiClock size={16} />
            </button>
          )}
          <button
            onClick={() => onDelete(plan.id)}
            className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger-muted rounded-lg transition-all"
            title="Delete"
            aria-label="Delete plan"
          >
            <FiXCircle size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
});
