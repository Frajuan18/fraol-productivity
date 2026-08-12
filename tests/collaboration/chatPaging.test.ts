// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Message } from '@/src/types/collaboration';
import {
  buildMessagePage,
  mergeMessageHistory,
  messageBeforeCursor,
  sortMessagesOldestFirst,
} from '@/lib/repositories/chatPaging';

function message(id: string, createdAt: string): Message {
  return {
    id,
    conversationId: 'c1',
    senderId: 'a',
    type: 'text',
    body: id,
    readAt: null,
    createdAt,
  };
}

describe('buildMessagePage', () => {
  it('returns the newest page oldest-first with a cursor when more exist', () => {
    const newestFirst = [
      message('m3', '2026-01-03T00:00:00.000Z'),
      message('m2', '2026-01-02T00:00:00.000Z'),
      message('m1', '2026-01-01T00:00:00.000Z'),
    ];
    const page = buildMessagePage(newestFirst, 2);
    expect(page.items.map((m) => m.id)).toEqual(['m2', 'm3']);
    expect(page.hasOlder).toBe(true);
    expect(page.nextCursor).toBe('2026-01-02T00:00:00.000Z');
  });

  it('exhausts when the page is smaller than the limit', () => {
    const page = buildMessagePage([message('m1', '2026-01-01T00:00:00.000Z')], 2);
    expect(page.items.map((m) => m.id)).toEqual(['m1']);
    expect(page.hasOlder).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('treats a limit-sized page as exhausted', () => {
    const page = buildMessagePage(
      [message('m2', '2026-01-02T00:00:00.000Z'), message('m1', '2026-01-01T00:00:00.000Z')],
      2,
    );
    expect(page.hasOlder).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});

describe('messageBeforeCursor', () => {
  it('matches strictly older timestamps', () => {
    expect(messageBeforeCursor(message('x', '2026-01-01T00:00:00.000Z'), '2026-01-02T00:00:00.000Z')).toBe(true);
    expect(messageBeforeCursor(message('x', '2026-01-02T00:00:00.000Z'), '2026-01-02T00:00:00.000Z')).toBe(false);
  });
});

describe('sortMessagesOldestFirst', () => {
  it('sorts chronologically', () => {
    const sorted = sortMessagesOldestFirst([
      message('b', '2026-01-02T00:00:00.000Z'),
      message('a', '2026-01-01T00:00:00.000Z'),
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('mergeMessageHistory', () => {
  it('prepends older history and dedupes by id without gaps', () => {
    const existing = [message('m2', '2026-01-02T00:00:00.000Z'), message('m3', '2026-01-03T00:00:00.000Z')];
    const older = [message('m1', '2026-01-01T00:00:00.000Z'), message('m2', '2026-01-02T00:00:00.000Z')];
    const merged = mergeMessageHistory(existing, older);
    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(merged.length).toBe(3);
  });

  it('preserves insertion order of realtime messages that share a timestamp', () => {
    const existing = [message('a', '2026-01-01T00:00:00.000Z')];
    const merged = mergeMessageHistory(existing, []);
    expect(merged.map((m) => m.id)).toEqual(['a']);
  });
});
