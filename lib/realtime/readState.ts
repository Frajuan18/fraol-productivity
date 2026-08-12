import type { Message } from '@/src/types/collaboration';

/**
 * Pure read-receipt derivation for Phase 10. Read state is persisted at the conversation
 * level as a per-user `lastReadAt` marker (readState: { [userId]: iso }). SSE events are
 * only a hint — the source of truth is MongoDB, and on reconnect the client re-reads
 * messages through this derivation. A message is considered read by its recipient when the
 * recipient's marker is >= the message creation time; legacy per-message `readAt` values
 * are kept as a fallback for records written before the conversation marker existed.
 */
export type ReadState = Record<string, string>;

export function deriveReadState(
  messages: Message[],
  readState: ReadState | undefined,
  myUserId: string,
): Message[] {
  if (!readState) return messages.map((m) => ({ ...m, readAt: m.readAt ?? null }));
  const partnerId = Object.keys(readState).find((id) => id !== myUserId);
  return messages.map((m) => {
    const readerId = m.senderId === myUserId ? partnerId : myUserId;
    const marker = readerId ? readState[readerId] : undefined;
    const derived = marker && m.createdAt <= marker ? marker : null;
    return { ...m, readAt: derived ?? m.readAt ?? null };
  });
}
