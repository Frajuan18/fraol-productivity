'use client';

import { memo, useEffect, useState } from 'react';
import { FiPause } from 'react-icons/fi';
import type { SharedFocusSession } from '@/src/types/collaboration';

/** Authoritative server clock: the server's `at` timestamp plus the local time it arrived. */
export interface ServerAnchor {
  at: number;
  receivedAt: number;
}

/**
 * Mutable box the SSE heartbeat writes into. The server clock is not render state: keeping
 * it in a ref lets the stream refresh `now` every second without re-rendering the workspace.
 */
export interface ServerAnchorRef {
  current: ServerAnchor | null;
}

/** Server-authoritative "now": last heartbeat extrapolated with the local clock delta. */
export function serverNowMs(anchor: ServerAnchor | null): number {
  return anchor ? anchor.at + (Date.now() - anchor.receivedAt) : Date.now();
}

/** Remaining time for a shared focus session, measured against the server clock. */
export function remainingMsFor(session: SharedFocusSession, anchor: ServerAnchor | null): number {
  if (session.status === 'ended') return 0;
  if (session.status === 'paused') {
    if (session.pausedAt && session.endsAt) {
      return Math.max(0, Date.parse(session.endsAt) - Date.parse(session.pausedAt));
    }
    return 0;
  }
  if (!session.endsAt) return 0;
  return Math.max(0, Date.parse(session.endsAt) - serverNowMs(anchor));
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

interface FocusCountdownProps {
  session: SharedFocusSession;
  anchorRef: ServerAnchorRef;
  partnerName: string;
}

/**
 * Owns the running countdown. The ticking state lives inside this leaf so a running timer
 * re-renders only these few nodes instead of the entire partner workspace, and the parent
 * never restarts an interval on every heartbeat.
 */
function FocusCountdown({ session, anchorRef, partnerName }: FocusCountdownProps) {
  const [remaining, setRemaining] = useState(0);
  const isRunning = session.status === 'running';

  useEffect(() => {
    setRemaining(remainingMsFor(session, anchorRef.current));
    if (!isRunning) return;
    const tick = () => setRemaining(remainingMsFor(session, anchorRef.current));
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [session, anchorRef, isRunning]);

  return (
    <>
      <div className="text-[11px] uppercase tracking-[0.14em] font-medium text-text-muted">
        {session.status === 'paused' ? 'Paused' : 'Focusing together'}
      </div>
      <div className="mt-2 text-3xl sm:text-4xl font-medium tracking-tight text-text tabular-nums leading-none">
        {formatRemaining(remaining)}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        {session.durationMinutes} min session · with {partnerName}
      </div>
      {session.status === 'paused' && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          <FiPause size={12} /> Timer paused — resume to keep going
        </div>
      )}
    </>
  );
}

export default memo(FocusCountdown);
