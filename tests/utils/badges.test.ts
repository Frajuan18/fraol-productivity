import { describe, it, expect } from 'vitest';
import {
  getPlanStatusBadgeClass,
  getPlanStatusLabel,
  getPlanPriorityBadgeClass,
  getPlanPriorityLabel,
  getSessionStatusBadgeClass,
  getSessionStatusLabel,
} from '@/src/utils/badges';
import { PLAN_STATUS, PLAN_PRIORITY, SESSION_STATUS } from '@/src/types';

describe('getPlanStatusBadgeClass', () => {
  it('returns completed class', () => {
    expect(getPlanStatusBadgeClass(PLAN_STATUS.COMPLETED)).toContain('green');
  });

  it('returns in-progress class', () => {
    expect(getPlanStatusBadgeClass(PLAN_STATUS.IN_PROGRESS)).toContain('blue');
  });

  it('returns pending class', () => {
    expect(getPlanStatusBadgeClass(PLAN_STATUS.PENDING)).toContain('yellow');
  });

  it('returns not-started class', () => {
    expect(getPlanStatusBadgeClass(PLAN_STATUS.NOT_STARTED)).toContain('text-muted');
  });
});

describe('getPlanStatusLabel', () => {
  it('returns "Completed"', () => {
    expect(getPlanStatusLabel(PLAN_STATUS.COMPLETED)).toBe('Completed');
  });

  it('returns "In Progress"', () => {
    expect(getPlanStatusLabel(PLAN_STATUS.IN_PROGRESS)).toBe('In Progress');
  });
});

describe('getPlanPriorityBadgeClass', () => {
  it('returns high priority class', () => {
    expect(getPlanPriorityBadgeClass(PLAN_PRIORITY.HIGH)).toContain('red');
  });

  it('returns medium priority class', () => {
    expect(getPlanPriorityBadgeClass(PLAN_PRIORITY.MEDIUM)).toContain('yellow');
  });

  it('returns low priority class', () => {
    expect(getPlanPriorityBadgeClass(PLAN_PRIORITY.LOW)).toContain('green');
  });
});

describe('getPlanPriorityLabel', () => {
  it('returns "High"', () => {
    expect(getPlanPriorityLabel(PLAN_PRIORITY.HIGH)).toBe('High');
  });
});

describe('getSessionStatusBadgeClass', () => {
  it('returns completed class', () => {
    expect(getSessionStatusBadgeClass(SESSION_STATUS.COMPLETED)).toContain('green');
  });

  it('returns in-progress class', () => {
    expect(getSessionStatusBadgeClass(SESSION_STATUS.IN_PROGRESS)).toContain('blue');
  });

  it('returns missed class', () => {
    expect(getSessionStatusBadgeClass(SESSION_STATUS.MISSED)).toContain('red');
  });
});

describe('getSessionStatusLabel', () => {
  it('returns the status string', () => {
    expect(getSessionStatusLabel(SESSION_STATUS.COMPLETED)).toBe(SESSION_STATUS.COMPLETED);
  });
});
