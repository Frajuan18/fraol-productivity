import { describe, it, expect } from 'vitest';
import {
  countSessionsByStatus,
  countPlansByStatus,
  calculateSuccessRate,
  calculatePlanCompletionRate,
  calculateWeeklyChange,
  calculateStreak,
  groupSessionsByDate,
  sortedSessionDates,
  hasSessionOnDate,
  sessionCountOnDate,
} from '@/src/utils/statistics';
import { SESSION_STATUS } from '@/src/types';
import type { Session, Plan } from '@/src/types';
import { formatShortDate } from '@/src/utils/date';

const jan1 = new Date(2025, 0, 1);
const jan2 = new Date(2025, 0, 2);
const jan3 = new Date(2025, 0, 3);

const mockSessions: Session[] = [
  {
    id: 1,
    task: 'Session 1',
    duration: '1h',
    date: formatShortDate(jan1),
    status: 'Completed',
    startTime: '10:00',
    endTime: '11:00',
  },
  {
    id: 2,
    task: 'Session 2',
    duration: '30m',
    date: formatShortDate(jan1),
    status: 'Completed',
    startTime: '11:00',
    endTime: '11:30',
  },
  {
    id: 3,
    task: 'Session 3',
    duration: '45m',
    date: formatShortDate(jan2),
    status: 'Missed',
    startTime: '12:00',
    endTime: '12:45',
  },
  {
    id: 4,
    task: 'Session 4',
    duration: '2h',
    date: formatShortDate(jan3),
    status: 'In Progress',
    startTime: '09:00',
    endTime: '11:00',
  },
];

const mockPlans: Plan[] = [
  {
    id: 1,
    title: 'Plan 1',
    description: 'Desc',
    type: 'daily',
    status: 'completed',
    date: 'Mon, Jan 1',
    priority: 'high',
    category: 'work',
  },
  {
    id: 2,
    title: 'Plan 2',
    description: 'Desc',
    type: 'weekly',
    status: 'in-progress',
    date: 'Tue, Jan 2',
    priority: 'medium',
    category: 'personal',
  },
  {
    id: 3,
    title: 'Plan 3',
    description: 'Desc',
    type: 'monthly',
    status: 'not-started',
    date: 'Wed, Jan 3',
    priority: 'low',
    category: 'health',
  },
];

describe('countSessionsByStatus', () => {
  it('counts completed sessions', () => {
    expect(countSessionsByStatus(mockSessions, SESSION_STATUS.COMPLETED)).toBe(2);
  });

  it('counts missed sessions', () => {
    expect(countSessionsByStatus(mockSessions, SESSION_STATUS.MISSED)).toBe(1);
  });

  it('returns 0 for unknown status', () => {
    expect(countSessionsByStatus(mockSessions, 'Unknown')).toBe(0);
  });
});

describe('countPlansByStatus', () => {
  it('counts completed plans', () => {
    expect(countPlansByStatus(mockPlans, 'completed')).toBe(1);
  });
});

describe('calculateSuccessRate', () => {
  it('calculates 50% for 2 completed out of 4', () => {
    expect(calculateSuccessRate(mockSessions)).toBe(50);
  });

  it('returns 0 for empty array', () => {
    expect(calculateSuccessRate([])).toBe(0);
  });
});

describe('calculatePlanCompletionRate', () => {
  it('calculates ~33% for 1 completed out of 3', () => {
    expect(calculatePlanCompletionRate(mockPlans)).toBe(33);
  });

  it('returns 0 for empty array', () => {
    expect(calculatePlanCompletionRate([])).toBe(0);
  });
});

describe('calculateWeeklyChange', () => {
  it('returns 0 when no sessions', () => {
    const result = calculateWeeklyChange([]);
    expect(result.change).toBe(0);
    expect(result.display).toBe('0%');
  });
});

describe('calculateStreak', () => {
  const today = new Date();
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  it('returns 0 for empty sessions', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('counts consecutive days', () => {
    const sessions = [
      {
        id: 1,
        task: 'S1',
        duration: '30m',
        date: todayStr,
        status: 'Completed' as const,
        startTime: '10:00',
        endTime: '10:30',
      },
    ];
    expect(calculateStreak(sessions)).toBe(1);
  });
});

describe('groupSessionsByDate', () => {
  it('groups sessions by date', () => {
    const grouped = groupSessionsByDate(mockSessions);
    const dateKey = formatShortDate(jan1);
    expect(Object.keys(grouped)).toContain(dateKey);
    expect(grouped[dateKey].length).toBe(2);
  });
});

describe('sortedSessionDates', () => {
  it('returns dates sorted descending', () => {
    const dates = sortedSessionDates(mockSessions);
    expect(dates[0]).toBe(formatShortDate(jan3));
    expect(dates[dates.length - 1]).toBe(formatShortDate(jan1));
  });
});

describe('hasSessionOnDate', () => {
  it('returns true when sessions exist on date', () => {
    expect(hasSessionOnDate(mockSessions, jan1)).toBe(true);
  });

  it('returns false when no sessions', () => {
    expect(hasSessionOnDate(mockSessions, new Date(2025, 0, 5))).toBe(false);
  });
});

describe('sessionCountOnDate', () => {
  it('returns correct count', () => {
    expect(sessionCountOnDate(mockSessions, jan1)).toBe(2);
  });
});
