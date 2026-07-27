import type { BibleVerse } from '@/src/types';

export const DEFAULT_FOCUS_SECONDS = 25 * 60;

export const DEFAULT_DASHBOARD_TIMER_SECONDS = 90 * 60;

export const SECONDS_PER_MINUTE = 60;

export const SECONDS_PER_HOUR = 3600;

export const MS_PER_SECOND = 1000;

export const MS_PER_MINUTE = 60 * MS_PER_SECOND;

export const MS_PER_HOUR = 60 * MS_PER_MINUTE;

export const PRESET_DURATIONS: ReadonlyArray<{
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
}> = [
  { hours: 0, minutes: 15, seconds: 0, label: '15m' },
  { hours: 0, minutes: 25, seconds: 0, label: '25m' },
  { hours: 0, minutes: 30, seconds: 0, label: '30m' },
  { hours: 0, minutes: 45, seconds: 0, label: '45m' },
  { hours: 1, minutes: 0, seconds: 0, label: '1h' },
  { hours: 1, minutes: 30, seconds: 0, label: '1.5h' },
  { hours: 2, minutes: 0, seconds: 0, label: '2h' },
];

export const QUICK_TASKS: readonly string[] = [
  'Deep Work',
  'Coding',
  'Reading',
  'Writing',
  'Design',
  'Research',
  'Learning',
  'Planning',
];

export const DEFAULT_TASK = 'Deep Work';

export const BACKGROUND_IMAGES: readonly string[] = [
  '/images/bg-1.jpg',
  '/images/bg-2.jpg',
  '/images/bg-3.jpg',
  '/images/bg-4.jpg',
  '/images/bg-5.jpg',
];

export const BACKGROUND_ROTATION_MS = 30 * MS_PER_MINUTE;

export const FALLBACK_BACKGROUND_IMAGE = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80';

export const BIBLE_API_BASE = 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/kjv/books/19/chapters';

export const FALLBACK_VERSES: readonly BibleVerse[] = [
  { verse: 'Trust in the Lord with all your heart and lean not on your own understanding', reference: 'Proverbs 3:5' },
  { verse: 'I can do all things through Christ who strengthens me', reference: 'Philippians 4:13' },
  { verse: 'The Lord is my shepherd; I shall not want', reference: 'Psalm 23:1' },
  { verse: 'Be still, and know that I am God', reference: 'Psalm 46:10' },
  { verse: 'This is the day that the Lord has made; let us rejoice and be glad in it', reference: 'Psalm 118:24' },
  {
    verse:
      'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God',
    reference: 'Philippians 4:6',
  },
  {
    verse:
      'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life',
    reference: 'John 3:16',
  },
  {
    verse: 'I have fought the good fight, I have finished the race, I have kept the faith',
    reference: '2 Timothy 4:7',
  },
  {
    verse: 'The steadfast love of the Lord never ceases; his mercies never come to an end',
    reference: 'Lamentations 3:22',
  },
  { verse: 'Fear not, for I am with you; be not dismayed, for I am your God', reference: 'Isaiah 41:10' },
];

export const AUTH_STORAGE_KEYS = {
  IS_AUTHENTICATED: 'isAuthenticated',
  USER: 'user',
} as const;

export const DEFAULT_USER_NAME = 'Fraol';

export const DASHBOARD_TABS = {
  OVERVIEW: 'overview',
  SESSIONS: 'sessions',
  STATS: 'stats',
  PLANS: 'plans',
  PROFILE: 'profile',
} as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[keyof typeof DASHBOARD_TABS];

export const PLAN_CATEGORIES = ['Work', 'Personal', 'Health', 'Learning', 'Fitness', 'Other'] as const;

export type PlanCategory = (typeof PLAN_CATEGORIES)[number];

export const HISTORY_FILTERS = ['all', 'completed', 'in-progress', 'pending', 'not-started'] as const;

export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export const API_DATA_URL = '/api/data';
