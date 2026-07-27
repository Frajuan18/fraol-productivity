'use client';

import { memo, useMemo } from 'react';
import { FiClock, FiCheckCircle, FiTrash2 } from 'react-icons/fi';
import { getSessionStatusBadgeClass } from '@/src/utils/badges';
import { groupSessionsByDate, sortedSessionDates } from '@/src/utils/statistics';
import type { Session } from '@/src/types';

interface SessionHistoryListProps {
  sessions: Session[];
  onDeleteSession: (id: number) => void;
}

export const SessionHistoryList = memo(function SessionHistoryList({
  sessions,
  onDeleteSession,
}: SessionHistoryListProps) {
  const grouped = useMemo(() => groupSessionsByDate(sessions), [sessions]);
  const sortedDates = useMemo(() => sortedSessionDates(sessions), [sessions]);

  if (sortedDates.length === 0) {
    return (
      <div className="text-center py-12">
        <FiClock className="mx-auto text-4xl text-text-muted mb-3 opacity-30" />
        <p className="text-sm text-text-secondary">No sessions yet</p>
        <p className="text-xs text-text-muted mt-1">Start your first focus session!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
      {sortedDates.map((date) => {
        const sessionsForDate = grouped[date] || [];
        const completedCount = sessionsForDate.filter((s) => s.status === 'Completed').length;
        const totalCount = sessionsForDate.length;
        const allCompleted = totalCount > 0 && completedCount === totalCount;

        return (
          <div
            key={date}
            className={`bg-surface-hover rounded-xl p-4 border ${allCompleted ? 'border-[var(--success)]/30' : 'border-border'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium text-text">{date}</h4>
                {allCompleted && <FiCheckCircle className="text-success" size={14} />}
              </div>
              <span className="text-xs text-text-secondary">
                {completedCount}/{totalCount} completed
              </span>
            </div>
            <div className="space-y-2">
              {sessionsForDate.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-2.5 bg-surface-hover rounded-xl border border-border hover:bg-surface-hover transition-all"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border ${getSessionStatusBadgeClass(session.status)}`}
                    >
                      <FiCheckCircle size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">{session.task}</div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <FiClock size={10} /> {session.duration}
                        </span>
                        {session.startTime && (
                          <span className="text-[10px] text-text-muted">
                            {session.startTime} - {session.endTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteSession(session.id)}
                    className="p-1 text-text-secondary hover:text-danger hover:bg-danger-muted rounded-lg transition-all"
                    aria-label={`Delete ${session.task} session`}
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});
