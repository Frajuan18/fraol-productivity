// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveReadState } from '@/lib/realtime/readState';
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

describe('deriveReadState', () => {
  it('derives read markers from the partner conversation marker', () => {
    const messages = [
      msg('1', 'u1', '2026-01-01T00:00:00.000Z'),
      msg('2', 'u2', '2026-01-01T00:00:01.000Z'),
      msg('3', 'u1', '2026-01-01T00:00:02.000Z'),
    ];
    const result = deriveReadState(messages, { u2: '2026-01-01T00:00:01.500Z' }, 'u1');
    expect(result[0].readAt).toBe('2026-01-01T00:00:01.500Z');
    expect(result[1].readAt).toBeNull();
    expect(result[2].readAt).toBeNull();
  });

  it('marks my own sent messages read by the partner marker', () => {
    const result = deriveReadState(
      [msg('1', 'u1', '2026-01-01T00:00:00.000Z')],
      { u2: '2026-01-01T00:00:05.000Z' },
      'u1',
    );
    expect(result[0].readAt).toBe('2026-01-01T00:00:05.000Z');
  });

  it('falls back to legacy per-message readAt when no marker exists', () => {
    const result = deriveReadState(
      [msg('1', 'u1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:03.000Z')],
      undefined,
      'u1',
    );
    expect(result[0].readAt).toBe('2026-01-01T00:00:03.000Z');
  });

  it('returns null readAt for all messages without any marker', () => {
    const result = deriveReadState(
      [msg('1', 'u1', '2026-01-01T00:00:00.000Z'), msg('2', 'u2', '2026-01-01T00:00:01.000Z')],
      undefined,
      'u1',
    );
    expect(result.every((m) => m.readAt === null)).toBe(true);
  });
});
