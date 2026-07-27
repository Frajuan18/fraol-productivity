import {
  isPlanPriority,
  isPlanStatus,
  isPlanType,
  isSessionStatus,
  type AppData,
  type Plan,
  type Session,
} from '@/src/types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isValidSession(value: unknown): value is Session {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'number' &&
    typeof value.task === 'string' &&
    typeof value.duration === 'string' &&
    typeof value.date === 'string' &&
    isSessionStatus(value.status)
  );
}

export function isValidPlan(value: unknown): value is Plan {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'number' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    isPlanType(value.type) &&
    isPlanStatus(value.status) &&
    typeof value.date === 'string' &&
    isPlanPriority(value.priority) &&
    typeof value.category === 'string'
  );
}

export function isValidAppData(value: unknown): value is AppData {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.plans) || !Array.isArray(value.sessions)) return false;
  if (!isObject(value.stats) || !isObject(value.user)) return false;

  if (!value.plans.every(isValidPlan)) return false;
  if (!value.sessions.every(isValidSession)) return false;

  return (
    typeof value.stats.focusTime === 'string' &&
    typeof value.stats.sessions === 'number' &&
    typeof value.stats.streak === 'string' &&
    typeof value.stats.productivity === 'string' &&
    typeof value.stats.totalFocusHours === 'number' &&
    typeof value.stats.weeklyStreak === 'number' &&
    typeof value.stats.dailyStreak === 'number' &&
    typeof value.user.name === 'string' &&
    typeof value.user.streak === 'number' &&
    typeof value.user.totalFocusHours === 'number' &&
    Array.isArray(value.user.taskTypes) &&
    value.user.taskTypes.every((t: unknown) => typeof t === 'string')
  );
}

export function coerceToAppData(value: unknown, fallback: AppData): AppData {
  return isValidAppData(value) ? value : fallback;
}
