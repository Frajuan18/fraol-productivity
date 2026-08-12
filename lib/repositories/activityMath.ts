import type { ActivityPage, SharedActivityItem } from '@/src/types/collaboration';

/**
 * Pure helpers for the cursor-paginated shared-activity feed. Items are sorted newest-first
 * by `createdAt`; older pages pass the last item's `createdAt` as the cursor.
 */

export function activityBeforeCursor(item: SharedActivityItem, cursor: string): boolean {
  return item.createdAt < cursor;
}

export function sortActivityNewestFirst(items: SharedActivityItem[]): SharedActivityItem[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildActivityPage(sortedNewestFirst: SharedActivityItem[], limit: number): ActivityPage {
  const hasMore = sortedNewestFirst.length > limit;
  const items = sortedNewestFirst.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last?.createdAt ? last.createdAt : null,
  };
}
