import type { DailyAnalyticsDoc, MonthlyAnalyticsDoc, WeeklyAnalyticsDoc } from '@/lib/mongodb/types';

/** Severity drives both ordering and the visual treatment of an insight. */
export type InsightSeverity = 'positive' | 'neutral' | 'attention';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  scope: 'day' | 'week' | 'month' | 'overall';
}

/**
 * Everything a single insight generator is allowed to look at. Generators are pure and
 * must never read storage — the engine hands them the precomputed summaries plus the
 * minimum derived signals they need.
 */
export interface InsightContext {
  userId: string;
  sampleDays: number;
  sampleWeeks: number;
  sampleMonths: number;
  todayFocusMinutes: number;
  dailies: DailyAnalyticsDoc[];
  weeklies: WeeklyAnalyticsDoc[];
  monthlies: MonthlyAnalyticsDoc[];
}

/** A generator returns exactly one insight, or null when there is not enough signal. */
export interface InsightGenerator {
  id: string;
  title: string;
  generate(context: InsightContext): Insight | null;
}

export interface AnalyticsResult {
  userId: string;
  computedAt: string;
  daily: DailyAnalyticsDoc[];
  weekly: WeeklyAnalyticsDoc[];
  monthly: MonthlyAnalyticsDoc[];
  insights: Insight[];
}

export const HOURLY_BUCKETS = 24;
