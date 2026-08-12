// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildSessionPage, sessionBeforeCursor, sortSessionsNewestFirst } from '@/lib/repositories/sessionPaging';
import type { Session } from '@/src/types';

function session(id: number, createdAt: string): Session {
  return {
    id,
    userId: 'u1',
    date: '2026-01-02',
    task: 'Focus',
    duration: '25 minutes',
    durationMinutes: 25,
    category: 'focus',
    status: 'Completed',
    planId: null,
    createdAt,
  } as Session;
}

describe('sortSessionsNewestFirst', () => {
  it('orders sessions newest first', () => {
    const result = sortSessionsNewestFirst([
      session(1, '2026-01-01T10:00:00.000Z'),
      session(2, '2026-01-02T10:00:00.000Z'),
      session(3, '2026-01-01T12:00:00.000Z'),
    ]);
    expect(result.map((s) => s.id)).toEqual([2, 3, 1]);
  });
});

describe('sessionBeforeCursor', () => {
  it('is true only for strictly older sessions', () => {
    const s = session(1, '2026-01-01T10:00:00.000Z');
    expect(sessionBeforeCursor(s, '2026-01-02T00:00:00.000Z')).toBe(true);
    expect(sessionBeforeCursor(s, '2026-01-01T10:00:00.000Z')).toBe(false);
    expect(sessionBeforeCursor(s, '2026-01-01T09:00:00.000Z')).toBe(false);
  });
});

describe('buildSessionPage', () => {
  it('returns a page with a next cursor when more rows were over-fetched', () => {
    const page = buildSessionPage(
      [
        session(1, '2026-01-03T00:00:00.000Z'),
        session(2, '2026-01-02T00:00:00.000Z'),
        session(3, '2026-01-01T00:00:00.000Z'),
      ],
      2,
    );
    expect(page.items.map((s) => s.id)).toEqual([1, 2]);
    expect(page.nextCursor).toBe('2026-01-02T00:00:00.000Z');
  });

  it('returns a null cursor when no more rows exist', () => {
    const page = buildSessionPage([session(1, '2026-01-03T00:00:00.000Z')], 2);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('never returns more than the limit', () => {
    const page = buildSessionPage(
      [1, 2, 3].map((i) => session(i, `2026-01-0${i}T00:00:00.000Z`)),
      3,
    );
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });
});
