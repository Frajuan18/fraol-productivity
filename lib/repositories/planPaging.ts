import type { Plan } from '@/src/types';
import type { PlanPage } from '@/src/types/collaboration';

/**
 * Pure helpers for the cursor-paginated plan history. Plans are sorted newest-first by
 * `updatedAt`; older pages pass the last item's `updatedAt` as the cursor.
 */

export function planBeforeCursor(plan: Plan, cursor: string): boolean {
  return (plan.updatedAt ?? '') < cursor;
}

export function sortPlansNewestFirst(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export function buildPlanPage(sortedNewestFirst: Plan[], limit: number): PlanPage {
  const hasMore = sortedNewestFirst.length > limit;
  const items = sortedNewestFirst.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last?.updatedAt ? last.updatedAt : null,
  };
}
