'use client';

import { FiActivity, FiPlay } from 'react-icons/fi';
import type { DashboardWidgetProps } from './types';

export default function CurrentSessionWidget({ bundle, onNavigateTab }: DashboardWidgetProps) {
  const { activeSession, activeSessionDisplay } = bundle;

  if (activeSession) {
    const completed = activeSession.status === 'Completed';
    return (
      <div className="flex h-full flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-accent-muted border border-border px-3 py-1.5 text-[13px] font-medium text-accent">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Session in progress
        </span>
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold tracking-tight text-text">{activeSession.task}</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
            <FiActivity size={14} className="text-accent" />
            <span className="tabular-nums text-accent">{activeSessionDisplay}</span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">{activeSession.duration}</span>
          </div>
        </div>
        <p className="text-[13px] text-text-muted">Stay focused — your streak depends on it.</p>
        <div className="mt-auto">
          <button
            onClick={() => onNavigateTab('sessions')}
            className="w-full flex items-center justify-center gap-2 rounded-[12px] bg-accent hover:bg-accent-hover text-accent-contrast h-11 text-[14px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiPlay size={15} className="fill-current" /> Manage session
          </button>
        </div>
        {completed && <p className="text-[12px] text-text-muted">This session is already completed.</p>}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center text-center py-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover">
        <FiPlay className="text-text-muted" size={20} />
      </div>
      <p className="mt-4 text-[15px] text-text-secondary">No session is running right now.</p>
      <p className="mt-1 text-[13px] text-text-muted">Start a focus session to build momentum.</p>
      <button
        onClick={() => onNavigateTab('sessions')}
        className="mt-5 inline-flex items-center gap-2 rounded-[12px] bg-accent hover:bg-accent-hover text-accent-contrast px-5 h-10 text-[14px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
      >
        <FiPlay size={15} className="fill-current" /> Start focus
      </button>
    </div>
  );
}
