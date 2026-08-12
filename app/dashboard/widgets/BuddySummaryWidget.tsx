'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiRefreshCw, FiUser } from 'react-icons/fi';
import { getRepository } from '@/lib/repositories/repository';
import type { PartnerOverview } from '@/lib/repositories/ProductivityRepository';
import type { DashboardWidgetProps } from './types';

export default function BuddySummaryWidget({ onNavigateTab }: DashboardWidgetProps) {
  const [overview, setOverview] = useState<PartnerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    getRepository()
      .getPartnerOverview('')
      .then((value) => {
        if (!cancelled) setOverview(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load partner summary.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const retry = () => {
    setError(null);
    setLoading(true);
    load();
  };

  if (loading) return null;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
        <p className="text-[13px] text-text-muted">Couldn&apos;t load your buddy summary.</p>
        <button
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-[10px] bg-surface-hover px-3 py-2 text-[12px] font-medium text-text-secondary hover:text-text transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <FiRefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-6 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-hover">
          <FiUser className="text-text-muted" size={18} />
        </div>
        <p className="mt-3 text-[14px] text-text-secondary">No shared buddy yet.</p>
        <p className="mt-0.5 text-[12px] text-text-muted">Connect with a partner to focus together.</p>
        <button
          onClick={() => onNavigateTab('partner')}
          className="mt-4 inline-flex items-center rounded-[10px] bg-accent hover:bg-accent-hover text-accent-contrast px-4 h-9 text-[13px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
        >
          Open shared space
        </button>
      </div>
    );
  }

  const { profile, statistics, privacy } = overview;
  const masked = statistics.privacyEnabled === false;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-muted text-sm font-semibold text-accent">
          {avatarInitial(profile.displayName)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-text">{profile.displayName}</span>
            <span className={`h-2 w-2 rounded-full ${masked ? 'bg-text-muted' : 'bg-accent'}`} aria-hidden="true" />
          </div>
          <span className="text-[11px] text-text-muted">{masked ? 'Stats kept private' : formatStatus(profile.status)}</span>
        </div>
      </div>

      {masked ? (
        <p className="rounded-xl bg-surface-hover/50 px-3 py-2 text-[12px] text-text-muted">
          Your buddy keeps sharing turned off, so their numbers stay private.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="This week" value={displayMinutes(statistics.focusMinutesThisWeek)} />
          <MiniStat label="Today" value={displayMinutes(statistics.focusMinutesToday)} />
          <MiniStat label="Streak" value={statistics.currentStreak > 0 ? `${statistics.currentStreak}d` : '—'} />
        </div>
      )}

      <button
        onClick={() => onNavigateTab('partner')}
        className="mt-auto inline-flex items-center justify-center rounded-[10px] bg-surface-hover px-3 py-2 text-[12px] font-medium text-text-secondary hover:text-text hover:bg-surface-raised transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        View shared space
      </button>

      {privacy && <p className="text-[10px] text-text-muted">Showing only what {profile.displayName} shares.</p>}
    </div>
  );
}

function avatarInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

function formatStatus(status: string): string {
  switch (status) {
    case 'focusing':
      return 'Focusing';
    case 'online':
      return 'Online';
    case 'away':
      return 'Away';
    default:
      return 'Offline';
  }
}

function displayMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-hover/50 px-3 py-2 text-center">
      <div className="text-[15px] font-semibold text-text tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] text-text-muted">{label}</div>
    </div>
  );
}