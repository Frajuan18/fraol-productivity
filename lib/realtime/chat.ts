import type { Message } from '@/src/types/collaboration';

/** Appends an incoming message unless one with the same id already exists (dedupe). */
export function upsertMessage(messages: Message[], incoming: Message): Message[] {
  if (messages.some((m) => m.id === incoming.id)) return messages;
  return [...messages, incoming];
}

/** Marks every unread message not sent by `readerId` as read. */
export function applyReadReceipt(messages: Message[], readerId: string, readAt: string): Message[] {
  return messages.map((m) => (m.senderId !== readerId && !m.readAt ? { ...m, readAt } : m));
}

/** Oldest first, stable across equal timestamps. */
export function sortMessages(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Number of messages from the partner that have not been read yet. */
export function countUnread(messages: Message[], myUserId: string): number {
  return messages.filter((m) => m.senderId !== myUserId && !m.readAt).length;
}
