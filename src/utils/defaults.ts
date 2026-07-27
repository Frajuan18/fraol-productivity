import { DEFAULT_USER_NAME } from '@/src/constants';
import type { AppData } from '@/src/types';

export function getDefaultData(): AppData {
  return {
    plans: [],
    sessions: [],
    stats: {
      focusTime: '0h',
      sessions: 0,
      streak: '0 days',
      productivity: '0%',
      totalFocusHours: 0,
      weeklyStreak: 0,
      dailyStreak: 0,
    },
    user: {
      name: DEFAULT_USER_NAME,
      streak: 0,
      totalFocusHours: 0,
      taskTypes: [],
    },
  };
}
