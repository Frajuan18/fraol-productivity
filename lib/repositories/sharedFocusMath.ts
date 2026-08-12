import type { SharedFocusSession } from '@/src/types/collaboration';

export interface PauseAccounting {
  status: SharedFocusSession['status'];
  pausedAt: string | null;
  totalPausedMs: number;
  endsAt: string | null;
}

/**
 * Settles a paused shared-focus session against `nowMs`: the elapsed pause is folded into
 * `totalPausedMs` and `endsAt` is pushed out by that same amount (server-authoritative timer).
 * Non-paused sessions pass through unchanged.
 */
export function settlePause(
  session: Pick<SharedFocusSession, 'status' | 'pausedAt' | 'endsAt' | 'totalPausedMs'>,
  nowMs: number,
): PauseAccounting {
  if (session.status !== 'paused' || !session.pausedAt || !session.endsAt) {
    return {
      status: session.status,
      pausedAt: session.pausedAt,
      totalPausedMs: session.totalPausedMs,
      endsAt: session.endsAt,
    };
  }
  const pausedMs = Math.max(0, nowMs - Date.parse(session.pausedAt));
  return {
    status: 'running',
    pausedAt: null,
    totalPausedMs: session.totalPausedMs + pausedMs,
    endsAt: new Date(Date.parse(session.endsAt) + pausedMs).toISOString(),
  };
}

/**
 * Actual focused milliseconds for a session being completed: wall-clock time since the
 * start minus accumulated pauses. Guarantees a floor so a zero-length focus still records.
 */
export function actualFocusMs(
  startedAt: string | null,
  totalPausedMs: number,
  nowMs: number,
  floorMs = 60_000,
): number {
  if (!startedAt) return floorMs;
  return Math.max(floorMs, nowMs - Date.parse(startedAt) - totalPausedMs);
}
