'use client';

import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FiClock, FiCheckCircle, FiTrash2, FiArrowRight, FiPlay } from 'react-icons/fi';
import { getSessionStatusBadgeClass, getSessionStatusLabel } from '@/src/utils/badges';
import { groupSessionsByDate, sortedSessionDates } from '@/src/utils/statistics';
import { parseDuration } from '@/src/utils/time';
import type { Session } from '@/src/types';

interface SessionHistoryListProps {
  sessions: Session[];
  onDeleteSession: (id: number) => void;
  onStartAgain?: (task: string, durationSeconds: number) => void;
  onStartNew?: () => void;
}

function statusIcon(status: Session['status']) {
  return status === 'Completed' ? FiCheckCircle : FiClock;
}

export const SessionHistoryList = memo(function SessionHistoryList({
  sessions,
  onDeleteSession,
  onStartAgain,
  onStartNew,
}: SessionHistoryListProps) {
  const reduced = useReducedMotion();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const grouped = useMemo(() => groupSessionsByDate(sessions), [sessions]);
  const sortedDates = useMemo(() => sortedSessionDates(sessions), [sessions]);

  if (sortedDates.length === 0) {
    return (
      <div className="card-glass rounded-[22px] p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mx-auto">
          <FiClock className="text-text-muted" size={20} aria-hidden />
        </div>
        <p className="mt-4 text-[15px] text-text-secondary">No sessions yet</p>
        <p className="mt-1 text-sm text-text-muted">Start your first focus session to build your history.</p>
        {onStartNew && (
          <button
            onClick={onStartNew}
            className="mt-5 inline-flex items-center gap-2 h-12 px-6 rounded-[14px] bg-accent hover:bg-accent-hover text-accent-contrast font-semibold text-[15px] transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiPlay size={17} fill="currentColor" aria-hidden /> Start a session
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card-glass rounded-[22px] divide-y divide-divider overflow-hidden">
      {sortedDates.map((date) => {
        const daySessions = grouped[date] || [];
        const completedCount = daySessions.filter((s) => s.status === 'Completed').length;
        const totalCount = daySessions.length;
        return (
          <div key={date}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h4 className="text-[13px] font-semibold text-text-secondary tracking-[-0.01em]">{date}</h4>
              <span className="text-xs text-text-muted tabular-nums">
                {completedCount}/{totalCount} completed
              </span>
            </div>
            {daySessions.map((session) => {
              const isExpanded = expandedId === session.id;
              const Icon = statusIcon(session.status);
              const totalSeconds = parseDuration(session.duration).totalSeconds;
              return (
                <div key={session.id} className="px-3 pb-1">
                  <div className="rounded-xl transition-colors duration-150 hover:bg-surface-hover/60">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : session.id)}
                      aria-expanded={isExpanded}
                      className="w-full flex items-center gap-3 px-2 py-3 text-left rounded-xl focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                    >
                      <div
                        className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 border ${getSessionStatusBadgeClass(session.status)}`}
                      >
                        <Icon size={16} aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">{session.task}</div>
                        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                          <span className="tabular-nums">{session.duration}</span>
                          {session.subject && <span className="text-accent/70">· {session.subject}</span>}
                          {session.startTime && (
                            <span className="tabular-nums">
                              {session.startTime}
                              {session.endTime ? ` – ${session.endTime}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-text-muted">
                        {getSessionStatusLabel(session.status)}
                      </span>
                      <motion.span
                        animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : 4 }}
                        transition={{ duration: reduced ? 0 : 0.15 }}
                        className="text-text-muted"
                      >
                        <FiArrowRight size={16} aria-hidden />
                      </motion.span>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: reduced ? 0 : 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="px-2 pb-3">
                            <div className="bg-surface-hover/70 border border-border rounded-xl px-4 py-3">
                              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <dt className="text-text-muted">Duration</dt>
                                  <dd className="mt-0.5 text-text font-medium tabular-nums">{session.duration}</dd>
                                </div>
                                {session.subject && (
                                  <div>
                                    <dt className="text-text-muted">Subject</dt>
                                    <dd className="mt-0.5 text-text font-medium">{session.subject}</dd>
                                  </div>
                                )}
                                <div>
                                  <dt className="text-text-muted">Start</dt>
                                  <dd className="mt-0.5 text-text font-medium tabular-nums">
                                    {session.startTime || '—'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-text-muted">End</dt>
                                  <dd className="mt-0.5 text-text font-medium tabular-nums">
                                    {session.endTime || '—'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-text-muted">Status</dt>
                                  <dd className="mt-0.5 text-text font-medium">
                                    {getSessionStatusLabel(session.status)}
                                  </dd>
                                </div>
                              </dl>
                              {session.actualDuration && (
                                <div className="mt-3 pt-3 border-t border-divider text-xs text-text-muted">
                                  Actual focus time:{' '}
                                  <span className="text-text font-medium tabular-nums">{session.actualDuration}</span>
                                </div>
                              )}
                              <div className="mt-3 flex items-center gap-2">
                                {onStartAgain && totalSeconds > 0 && (
                                  <button
                                    onClick={() => onStartAgain(session.task, totalSeconds)}
                                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-contrast text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                                  >
                                    <FiPlay size={13} fill="currentColor" aria-hidden /> Start again
                                  </button>
                                )}
                                <button
                                  onClick={() => onDeleteSession(session.id)}
                                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-medium text-text-muted hover:text-danger hover:bg-danger/10 transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                                >
                                  <FiTrash2 size={13} aria-hidden /> Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});
