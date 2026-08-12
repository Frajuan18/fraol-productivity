import type { PlanPriority, PlanTypeValue } from '@/src/types';

/**
 * A draft plan the user is composing. Only a subset of fields are filled in at any moment;
 * the assistant treats missing fields as "not yet decided" and never fabricates an identity.
 */
export interface PlanDraft {
  title?: string;
  category?: string;
  priority?: PlanPriority;
  type?: PlanTypeValue;
  /** Currently selected due date (YYYY-MM-DD), when the user has chosen one. */
  date?: string;
  description?: string;
}

export type Confidence = 'high' | 'medium' | 'low';

export type RecommendationKind =
  | 'duration'
  | 'focus-block'
  | 'due-date'
  | 'schedule'
  | 'confidence'
  | 'overload'
  | 'balance'
  | 'split'
  | 'merge'
  | 'reminder';

/**
 * A patch the UI applies when the user clicks "Apply" on a recommendation. Recommendations
 * never mutate anything themselves — they only carry an explicit, user-approved payload.
 */
export interface DraftPatch {
  /** Set the plan's due date (YYYY-MM-DD). */
  date?: string;
  /** Set the plan's priority. */
  priority?: PlanPriority;
  /** Append a line to the plan description (e.g. a suggested schedule). */
  descriptionAppend?: string;
  /** Suggested number of focus sessions for the plan. */
  sessions?: number;
  /** Suggested focus block length in minutes. */
  blockMinutes?: number;
  /** Estimated total duration in minutes. */
  durationMinutes?: number;
}

export interface PlanRecommendation {
  id: string;
  kind: RecommendationKind;
  /** Short label, e.g. "Estimated duration". */
  label: string;
  /** Primary display value, e.g. "2h 15m". */
  value: string;
  /** Supporting copy shown under the value. */
  detail?: string;
  confidence: Confidence;
  apply: DraftPatch;
  canApply: boolean;
}

export interface RecommendationsInput {
  draft: PlanDraft;
  signals: HistorySignals;
}

/** Signals derived from the user's real history; the only input the assistant trusts. */
export interface HistorySignals {
  avgSessionMinutes: number;
  medianSessionMinutes: number;
  sessionsPerDay: number;
  sessionsPerWeek: number;
  dailyCapacityMinutes: number;
  weeklyCapacityMinutes: number;
  planCompletionRate: number;
  /** Per-category session statistics for duration estimation. */
  categoryStats: Record<string, { avgSessionMinutes: number; sessionCount: number; planCount: number }>;
  /** Hour-of-day (0-23) with the most historical focus, when measurable. */
  bestHour: number | null;
  /** Weekday (0=Mon..6=Sun) with the most historical focus, when measurable. */
  bestWeekday: number | null;
  /** Days that already carry more planned focus than the user's daily capacity. */
  overloadDays: { date: string; loadMinutes: number }[];
  /** Open (non-completed) plans with their due dates. */
  openPlans: { id: number; title: string; date: string; category: string; priority: PlanPriority }[];
  /** Fraction of open plans whose due date has already passed. */
  overdueRatio: number;
  /** Number of plans (open or completed) that share the same category as the draft. */
  similarPlanCount: number;
}

/** Confidence level with a human-readable explanation. */
export interface EstimationResult {
  minutes: number;
  confidence: Confidence;
  reason: string;
}
