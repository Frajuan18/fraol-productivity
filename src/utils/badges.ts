import {
  PLAN_PRIORITY,
  PLAN_STATUS,
  SESSION_STATUS,
  type PlanPriority,
  type PlanStatus,
  type SessionStatus,
} from '@/src/types';

export function getPlanStatusBadgeClass(status: PlanStatus): string {
  switch (status) {
    case PLAN_STATUS.COMPLETED:
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case PLAN_STATUS.IN_PROGRESS:
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case PLAN_STATUS.PENDING:
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case PLAN_STATUS.NOT_STARTED:
    default:
      return 'bg-surface-hover text-text-muted border-border';
  }
}

export function getPlanStatusLabel(status: PlanStatus): string {
  switch (status) {
    case PLAN_STATUS.COMPLETED:
      return 'Completed';
    case PLAN_STATUS.IN_PROGRESS:
      return 'In Progress';
    case PLAN_STATUS.PENDING:
      return 'Pending';
    case PLAN_STATUS.NOT_STARTED:
    default:
      return 'Not Started';
  }
}

export function getPlanPriorityBadgeClass(priority: PlanPriority): string {
  switch (priority) {
    case PLAN_PRIORITY.HIGH:
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case PLAN_PRIORITY.MEDIUM:
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case PLAN_PRIORITY.LOW:
    default:
      return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
}

export function getPlanPriorityLabel(priority: PlanPriority): string {
  switch (priority) {
    case PLAN_PRIORITY.HIGH:
      return 'High';
    case PLAN_PRIORITY.MEDIUM:
      return 'Medium';
    case PLAN_PRIORITY.LOW:
    default:
      return 'Low';
  }
}

export function getSessionStatusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case SESSION_STATUS.COMPLETED:
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case SESSION_STATUS.IN_PROGRESS:
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case SESSION_STATUS.MISSED:
    default:
      return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

export function getSessionStatusLabel(status: SessionStatus): string {
  return status;
}
