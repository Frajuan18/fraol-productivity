'use client';

import { useCallback, useState } from 'react';
import { SESSION_STATUS } from '@/src/types';
import type { Session, SessionStatus } from '@/src/types';

export interface UseSessionsResult {
  sessions: Session[];
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: number, patch: Partial<Session>) => void;
  deleteSession: (id: number) => void;
  replaceAll: (sessions: Session[]) => void;
}

export function useSessions(initial: Session[] = []): UseSessionsResult {
  const [sessions, setSessionsState] = useState<Session[]>(initial);

  const setSessions = useCallback((next: Session[]) => {
    setSessionsState(next);
  }, []);

  const addSession = useCallback((session: Session) => {
    setSessionsState((prev) => [...prev, session]);
  }, []);

  const updateSession = useCallback((id: number, patch: Partial<Session>) => {
    setSessionsState((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const deleteSession = useCallback((id: number) => {
    setSessionsState((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const replaceAll = useCallback((next: Session[]) => {
    setSessionsState(next);
  }, []);

  return {
    sessions,
    setSessions,
    addSession,
    updateSession,
    deleteSession,
    replaceAll,
  };
}

export function createSession(input: {
  task: string;
  duration: string;
  date: string;
  status?: SessionStatus;
  startTime?: string;
  endTime?: string;
  actualDuration?: string;
}): Session {
  return {
    id: Date.now(),
    task: input.task,
    duration: input.duration,
    date: input.date,
    status: input.status ?? SESSION_STATUS.COMPLETED,
    startTime: input.startTime,
    endTime: input.endTime,
    actualDuration: input.actualDuration,
  };
}
