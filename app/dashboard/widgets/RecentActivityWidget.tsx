'use client';

import { FiArrowRight, FiPlay } from 'react-icons/fi';
import type { DashboardWidgetProps } from './types';

export default function RecentActivityWidget({ bundle, onNavigateTab }: DashboardWidgetProps) {
  const { recentSessions } = bundle;

  if (recentSessions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-6 text-center">
        <p className="text-[14px] text-text-secondary">No sessions yet.</p>
        <p className="mt-0.5 text-[12px] text-text-muted">Start your first focus session to build history.</p>
        <button
          onClick={() => onNavigateTab('sessions')}
          className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-accent hover:bg-accent-hover text-accent-contrast px-4 h-9 text-[13px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
        >
          <FiPlay size={14} className="fill-current" /> Start focus
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="divide-y divide-divider">
        {recentSessions.map((session, index) => {
          const isCompleted = session.status === 'Completed';
          const isProgress = session.status === 'In Progress';
          const dotColor = isCompleted ? 'bg-accent' : isProgress ? 'bg-warning' : 'bg-danger';
          return (
            <li key={session.id || index} className="flex items-center gap-3 py-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
              <button
                onClick={() => onNavigateTab('sessions')}
                className="min-w-0 flex-1 text-left rounded outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span className="block truncate text-[14px] text-text">{session.task}</span>
                <span className="block text-[11px] text-text-muted mt-0.5">
                  {session.duration} · {session.date}
                  {session.startTime ? ` · ${session.startTime}` : ''}
                </span>
              </button>
              <span
                className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${isCompleted ? 'bg-success/10 text-success' : isProgress ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'}`}
              >
                {session.status}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        onClick={() => onNavigateTab('sessions')}
        className="mt-auto inline-flex items-center gap-1.5 pt-3 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
      >
        View all sessions <FiArrowRight size={14} />
      </button>
    </div>
  );
}
