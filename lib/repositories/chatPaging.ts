import type { Message, MessagePage } from '@/src/types/collaboration';

/**
 * Pure helpers for cursor-paginated chat history. The first page returns the newest
 * `limit` messages oldest-first. Older pages pass `cursor` = the oldest loaded message's
 * `createdAt` and get the messages strictly older than it. Identical-timestamp collisions
 * are handled conservatively: when a full page was fetched, `hasOlder` is true and the next
 * query starts strictly before the last returned timestamp.
 */

/** True when a message is strictly older than the given cursor. */
export function messageBeforeCursor(message: Message, cursor: string): boolean {
  return message.createdAt < cursor;
}

/** Sorts messages oldest-first (the chat render order), stable for ties. */
export function sortMessagesOldestFirst(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Trims an over-fetched (limit+1) newest-first array into a page of the newest `limit`. */
export function buildMessagePage(sortedNewestFirst: Message[], limit: number): MessagePage {
  const hasOlder = sortedNewestFirst.length > limit;
  const items = sortMessagesOldestFirst(sortedNewestFirst.slice(0, limit));
  const oldest = items[0];
  return {
    items,
    hasOlder,
    nextCursor: hasOlder && oldest ? oldest.createdAt : null,
  };
}

/**
 * Merges an older page into the currently loaded (oldest-first) list. Deduplicates by id
 * and keeps the result sorted, so prepending history can never produce gaps or duplicates.
 */
export function mergeMessageHistory(existing: Message[], older: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const message of [...existing, ...older]) byId.set(message.id, message);
  return sortMessagesOldestFirst([...byId.values()]);
}
