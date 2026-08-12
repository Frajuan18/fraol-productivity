// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { actualFocusMs, settlePause } from '@/lib/repositories/sharedFocusMath';

const startedAt = '2026-01-01T10:00:00.000Z';
const endsAt = '2026-01-01T10:25:00.000Z';

describe('settlePause', () => {
  it('passes a running session through unchanged', () => {
    const result = settlePause(
      { status: 'running', pausedAt: null, totalPausedMs: 0, endsAt },
      Date.parse('2026-01-01T10:10:00.000Z'),
    );
    expect(result).toEqual({ status: 'running', pausedAt: null, totalPausedMs: 0, endsAt });
  });

  it('folds the elapsed pause into totalPausedMs and pushes endsAt out by the same amount', () => {
    const pausedAt = '2026-01-01T10:10:00.000Z';
    const resumeAt = '2026-01-01T10:12:00.000Z';
    const result = settlePause({ status: 'paused', pausedAt, totalPausedMs: 0, endsAt }, Date.parse(resumeAt));
    expect(result.totalPausedMs).toBe(120_000);
    expect(result.status).toBe('running');
    expect(result.pausedAt).toBeNull();
    expect(result.endsAt).toBe('2026-01-01T10:27:00.000Z');
  });

  it('accumulates across multiple pauses', () => {
    const pausedAt = '2026-01-01T10:20:00.000Z';
    const result = settlePause(
      { status: 'paused', pausedAt, totalPausedMs: 300_000, endsAt },
      Date.parse('2026-01-01T10:22:00.000Z'),
    );
    expect(result.totalPausedMs).toBe(420_000);
  });

  it('ignores a negative clock skew', () => {
    const pausedAt = '2026-01-01T10:12:00.000Z';
    const result = settlePause(
      { status: 'paused', pausedAt, totalPausedMs: 0, endsAt },
      Date.parse('2026-01-01T10:10:00.000Z'),
    );
    expect(result.totalPausedMs).toBe(0);
  });
});

describe('actualFocusMs', () => {
  it('subtracts pauses from wall-clock time', () => {
    const now = Date.parse('2026-01-01T10:25:00.000Z');
    expect(actualFocusMs(startedAt, 300_000, now)).toBe(25 * 60_000 - 300_000);
  });

  it('enforces a positive floor', () => {
    expect(actualFocusMs(startedAt, 0, Date.parse(startedAt))).toBe(60_000);
  });

  it('handles a missing start by returning the floor', () => {
    expect(actualFocusMs(null, 0, Date.now())).toBe(60_000);
  });
});
