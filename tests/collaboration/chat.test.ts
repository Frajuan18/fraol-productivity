// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  applyReadReceipt,
  countUnread,
  sortMessages,
  upsertMessage,
} from '@/lib/realtime/chat';
import type { Message } from '@/src/types/collaboration';

function msg(id: string, senderId: string, createdAt: string, readAt?: string | null): Message {
  return {
    id,
    conversationId: 'c1',
    senderId,
    type: 'text',
    body: 'hi',
    planId: null,
    sharedFocusId: null,
    readAt: readAt ?? null,
    createdAt,
  };
}

describe('upsertMessage', () => {
  it('appends a new message', () => {
    const result = upsertMessage([msg('a', 'u1', '2026-01-01T00:00:00.000Z')], msg('b', 'u2', '2026-01-01T00:00:01.000Z'));
    expect(result).toHaveLength(2);
  });

  it('ignores a duplicate (realtime echo)', () => {
    const existing = msg('a', 'u1', '2026-01-01T00:00:00.000Z');
    const result = upsertMessage([existing], existing);
    expect(result).toHaveLength(1);
  });
});

describe('applyReadReceipt', () => {
  it('marks the partner unread messages as read and leaves my own alone', () => {
    const messages = [msg('1', 'u1', '2026-01-01T00:00:00.000Z'), msg('2', 'u2', '2026-01-01T00:00:01.000Z')];
    const result = applyReadReceipt(messages, 'u1', '2026-01-01T00:00:02.000Z');
    expect(result[0].readAt).toBeNull();
    expect(result[1].readAt).toBe('2026-01-01T00:00:02.000Z');
  });
});

describe('sortMessages', () => {
  it('orders oldest first', () => {
    const result = sortMessages([msg('2', 'u2', '2026-01-01T00:00:02.000Z'), msg('1', 'u1', '2026-01-01T00:00:01.000Z')]);
    expect(result[0].id).toBe('1');
  });
});

describe('countUnread', () => {
  it('counts partner messages without a read receipt', () => {
    const messages = [msg('1', 'u1', '2026-01-01T00:00:00.000Z'), msg('2', 'u2', '2026-01-01T00:00:01.000Z')];
    expect(countUnread(messages, 'u1')).toBe(1);
  });
});
