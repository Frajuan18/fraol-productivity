import type { Session } from '@/src/types';
import type { SessionPage } from '@/lib/repositories/ProductivityRepository';

/**
 * Pure helpers for cursor-paginated session history. The Mongo adapter fetches `limit + 1`
 * rows sorted newest-first and feeds them to `buildSessionPage`, which trims to `limit`
 * and derives the next cursor from the oldest returned row. Collisions on identical
 * `createdAt` timestamps are treated conservatively: when a full page was fetched there is
 * assumed to be more, and the next query starts strictly before the last seen timestamp.
 */

/** Sorts sessions newest-first by their cursor field (createdAt), stable for ties. */
export function sortSessionsNewestFirst(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** True when a session is strictly older than the given cursor. */
export function sessionBeforeCursor(session: Session, cursor: string): boolean {
  return (session.createdAt ?? '') < cursor;
}

/** Trims an over-fetched (limit+1) newest-first array into a page with a next cursor. */
export function buildSessionPage(sortedNewestFirst: Session[], limit: number): SessionPage {
  const hasMore = sortedNewestFirst.length > limit;
  const items = sortedNewestFirst.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last?.createdAt ? last.createdAt : null,
  };
}
