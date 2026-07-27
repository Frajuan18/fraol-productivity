import { describe, it, expect } from 'vitest';
import { getDefaultData } from '@/src/utils/defaults';

describe('getDefaultData', () => {
  it('returns an empty plans array', () => {
    expect(getDefaultData().plans).toEqual([]);
  });

  it('returns an empty sessions array', () => {
    expect(getDefaultData().sessions).toEqual([]);
  });

  it('returns stats with default values', () => {
    const stats = getDefaultData().stats;
    expect(stats.focusTime).toBe('0h');
    expect(stats.sessions).toBe(0);
    expect(stats.dailyStreak).toBe(0);
  });

  it('returns a default user', () => {
    const user = getDefaultData().user;
    expect(user.name).toBe('Fraol');
    expect(user.streak).toBe(0);
    expect(user.totalFocusHours).toBe(0);
    expect(user.taskTypes).toEqual([]);
  });
});
