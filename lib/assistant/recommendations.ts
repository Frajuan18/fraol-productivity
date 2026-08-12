import type { PlanPriority } from '@/src/types';
import { todayIso } from './signals';
import type {
  DraftPatch,
  EstimationResult,
  PlanRecommendation,
  PlanDraft,
  HistorySignals,
  RecommendationsInput,
} from './types';

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_SESSION_MINUTES = 45;

export function formatMinutes(total: number): string {
  if (total <= 0) return '0m';
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function weekdayLabel(wd: number): string {
  return WEEKDAY_LABELS[wd] ?? `Day ${wd + 1}`;
}

export function hourLabel(hour: number): string {
  const display = ((hour + 11) % 12) + 1;
  return `${display}${hour >= 12 ? ' PM' : ' AM'}`;
}

function categoryKey(category: string | undefined): string {
  return (category ?? '').trim().toLowerCase();
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextOccurrence(now: Date, targetWeekday: number, maxDays = 14): string {
  const currentWeekday = (now.getDay() + 6) % 7;
  let delta = (targetWeekday - currentWeekday + 7) % 7;
  if (delta === 0) delta = 7;
  if (delta > maxDays) return todayIso(now);
  return todayIso(addDays(now, delta));
}

function isOverloaded(signals: HistorySignals, date: string): boolean {
  return signals.overloadDays.some((d) => d.date === date);
}

/**
 * Estimates how long a plan of this shape usually takes, using the user's own
 * session history per category (falling back to their global average).
 */
export function estimateDuration(draft: PlanDraft, signals: HistorySignals): EstimationResult {
  const key = categoryKey(draft.category);
  const category = key ? signals.categoryStats[key] : undefined;

  if (category && category.sessionCount > 0) {
    return {
      minutes: Math.max(15, category.avgSessionMinutes),
      confidence: category.sessionCount >= 3 ? 'high' : 'medium',
      reason:
        category.sessionCount >= 3
          ? `Based on ${category.sessionCount} ${draft.category} sessions averaging ${formatMinutes(
              category.avgSessionMinutes,
            )}.`
          : `Only ${category.sessionCount} similar session tracked so far; estimate may shift.`,
    };
  }

  if (signals.avgSessionMinutes > 0) {
    return {
      minutes: Math.max(15, signals.avgSessionMinutes),
      confidence: signals.medianSessionMinutes > 0 ? 'medium' : 'low',
      reason: `Based on your overall average focus session of ${formatMinutes(signals.avgSessionMinutes)}.`,
    };
  }

  if (signals.medianSessionMinutes > 0) {
    return {
      minutes: Math.max(15, signals.medianSessionMinutes),
      confidence: 'low',
      reason: `Few sessions on record; using your typical ${formatMinutes(signals.medianSessionMinutes)} session as a starting point.`,
    };
  }

  return {
    minutes: DEFAULT_SESSION_MINUTES,
    confidence: 'low',
    reason: 'No focus history yet, so this is a conservative default you can adjust.',
  };
}

/** Suggests how many focus sessions and block length a plan should be broken into. */
export function suggestFocusBlocks(draft: PlanDraft, signals: HistorySignals): PlanRecommendation | null {
  const estimation = estimateDuration(draft, signals);
  const block = signals.medianSessionMinutes > 0 ? signals.medianSessionMinutes : signals.avgSessionMinutes > 0 ? signals.avgSessionMinutes : DEFAULT_SESSION_MINUTES;
  const blockMinutes = Math.max(15, Math.round(block / 15) * 15);
  const sessions = Math.min(5, Math.max(1, Math.round(estimation.minutes / blockMinutes)));
  const total = sessions * blockMinutes;

  if (Math.abs(total - estimation.minutes) <= blockMinutes / 2 && sessions === 1) return null;

  const apply: DraftPatch = { sessions, blockMinutes };
  return {
    id: 'focus-block',
    kind: 'focus-block',
    label: 'Suggested pacing',
    value: `${sessions} x ${blockMinutes}m`,
    detail: `Break this plan into ${sessions} focus session${sessions !== 1 ? 's' : ''} of ${blockMinutes} minutes (${formatMinutes(total)} total).`,
    confidence: estimation.confidence,
    apply,
    canApply: false,
  };
}

/** Finds the best due date for the draft: next best focus weekday, or the next free day. */
export function suggestDueDate(draft: PlanDraft, signals: HistorySignals): PlanRecommendation | null {
  const today = todayIso();

  if (draft.date && isOverloaded(signals, draft.date)) {
    const load = signals.overloadDays.find((d) => d.date === draft.date)?.loadMinutes;
    for (let i = 1; i <= 7; i += 1) {
      const candidate = todayIso(addDays(new Date(today), i));
      if (!isOverloaded(signals, candidate)) {
        const apply: DraftPatch = { date: candidate };
        return {
          id: 'due-date-overload',
          kind: 'overload',
          label: 'Day looks busy',
          value: candidate,
          detail: `You already have ${formatMinutes(load ?? 0)} of open plans on ${draft.date}. Moving to ${candidate} keeps the week balanced.`,
          confidence: 'high',
          apply,
          canApply: candidate !== draft.date,
        };
      }
    }
    return null;
  }

  if (signals.bestWeekday !== null && signals.avgSessionMinutes > 0 && !draft.date) {
    const candidate = nextOccurrence(new Date(today), signals.bestWeekday);
    if (isOverloaded(signals, candidate)) return null;
    const apply: DraftPatch = { date: candidate };
    return {
      id: 'due-date-ideal',
      kind: 'due-date',
      label: 'Ideal day',
      value: candidate,
      detail: `You focus most on ${weekdayLabel(signals.bestWeekday)}. Starting then keeps momentum.`,
      confidence: signals.medianSessionMinutes > 0 ? 'high' : 'medium',
      apply,
      canApply: candidate !== draft.date,
    };
  }

  return null;
}

/** Suggests a schedule (weekday + hour) derived from when the user actually focuses. */
export function suggestSchedule(draft: PlanDraft, signals: HistorySignals): PlanRecommendation | null {
  if (signals.bestHour === null && signals.bestWeekday === null) return null;
  const parts: string[] = [];
  if (signals.bestWeekday !== null) parts.push(`best on ${weekdayLabel(signals.bestWeekday)}`);
  if (signals.bestHour !== null) parts.push(`around ${hourLabel(signals.bestHour)}`);
  const apply: DraftPatch = { descriptionAppend: `Suggested schedule: ${parts.join(', ')}.` };
  return {
    id: 'schedule',
    kind: 'schedule',
    label: 'Suggested schedule',
    value: parts.join(' · '),
    detail: 'Based on when you have been most focused in your history.',
    confidence: signals.medianSessionMinutes > 0 ? 'medium' : 'low',
    apply,
    canApply: true,
  };
}

/** Flags plans that look too large for the user's historical weekly capacity. */
export function suggestSplit(draft: PlanDraft, signals: HistorySignals): PlanRecommendation | null {
  const estimation = estimateDuration(draft, signals);
  if (signals.weeklyCapacityMinutes <= 0 || estimation.minutes <= signals.weeklyCapacityMinutes * 1.5) return null;
  const sessions = Math.min(5, Math.ceil(estimation.minutes / Math.max(1, signals.dailyCapacityMinutes)));
  const apply: DraftPatch = { sessions };
  return {
    id: 'split',
    kind: 'split',
    label: 'Large scope',
    value: `Split across ${sessions} days`,
    detail: `This looks like ${formatMinutes(estimation.minutes)} of focus — more than your typical weekly ${formatMinutes(
      signals.weeklyCapacityMinutes,
    )}. Splitting keeps each day realistic.`,
    confidence: 'medium',
    apply,
    canApply: false,
  };
}

/** Notices several open plans on the same day and suggests consolidating. */
export function suggestMerge(draft: PlanDraft, signals: HistorySignals): PlanRecommendation | null {
  if (!draft.date) return null;
  const key = categoryKey(draft.category);
  const sameDay = signals.openPlans.filter((p) => p.date === draft.date);
  const sameCategory = sameDay.filter((p) => categoryKey(p.category) === key);
  const peers = key ? sameCategory : sameDay;
  if (peers.length < 2) return null;
  return {
    id: 'merge',
    kind: 'merge',
    label: 'Possible merge',
    value: `${peers.length} plans due ${draft.date}`,
    detail: `You already have ${peers.length} open plans on this date. Combining related items into one plan is easier to complete.`,
    confidence: 'medium',
    apply: {},
    canApply: false,
  };
}

/** Suggests priority from backlog pressure in the user's category. */
export function suggestPriority(draft: PlanDraft, signals: HistorySignals): PlanRecommendation | null {
  const key = categoryKey(draft.category);
  const categoryOpen = signals.openPlans.filter((p) => categoryKey(p.category) === key);
  const backlogged = signals.openPlans.filter((p) => p.date < todayIso()).length;
  if (categoryOpen.length === 0 && backlogged < 2) return null;
  if (draft.priority === 'high') return null;
  const target: PlanPriority = 'high';
  const apply: DraftPatch = { priority: target };
  const reason =
    categoryOpen.length > 0
      ? `${categoryOpen.length} open ${draft.category ? `${draft.category.toLowerCase()} ` : ''}plan${
          categoryOpen.length !== 1 ? 's' : ''
        } are already waiting on you.`
      : `${backlogged} plan${backlogged !== 1 ? 's' : ''} are past their due date right now.`;
  return {
    id: 'priority',
    kind: 'confidence',
    label: 'Raise priority',
    value: 'High',
    detail: reason,
    confidence: 'medium',
    apply,
    canApply: true,
  };
}

/** When completion has been weak, nudges scope down rather than up. */
export function suggestRealism(draft: PlanDraft, signals: HistorySignals): PlanRecommendation | null {
  if (signals.planCompletionRate >= 0.5 || signals.overdueRatio < 0.25) return null;
  const apply: DraftPatch = {};
  const value =
    signals.overdueRatio > 0.5
      ? 'Smaller first step'
      : signals.planCompletionRate > 0
        ? 'Trimmed scope'
        : 'One session to start';
  return {
    id: 'realism',
    kind: 'balance',
    label: 'Keep it realistic',
    value,
    detail: `You complete about ${Math.round(signals.planCompletionRate * 100)}% of plans and ${Math.round(
      signals.overdueRatio * 100,
    )}% are past due. Starting smaller builds momentum.`,
    confidence: 'medium',
    apply,
    canApply: false,
  };
}

/** Adds a lightweight reminder suggestion when a preferred focus hour exists. */
export function suggestReminder(draft: PlanDraft, signals: HistorySignals): PlanRecommendation | null {
  if (signals.bestHour === null) return null;
  const apply: DraftPatch = {};
  return {
    id: 'reminder',
    kind: 'reminder',
    label: 'Remind me',
    value: hourLabel(signals.bestHour),
    detail: `You focus best around ${hourLabel(signals.bestHour)}. A nudge then has the best odds of turning into a session.`,
    confidence: 'medium',
    apply,
    canApply: false,
  };
}

const BUILDERS: ((draft: PlanDraft, signals: HistorySignals) => PlanRecommendation | null)[] = [
  suggestDueDate,
  suggestSchedule,
  suggestFocusBlocks,
  suggestSplit,
  suggestMerge,
  suggestPriority,
  suggestRealism,
  suggestReminder,
];

const MAX_RECOMMENDATIONS = 4;

/**
 * Pure entry point: derives all suggestions from the current draft + history signals.
 * Never mutates plans or drafts — every payload goes through an explicit Apply action.
 */
export function buildRecommendations(input: RecommendationsInput): PlanRecommendation[] {
  const { draft, signals } = input;
  const recommendations: PlanRecommendation[] = [];
  for (const builder of BUILDERS) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;
    const rec = builder(draft, signals);
    if (rec) recommendations.push(rec);
  }
  return recommendations;
}
