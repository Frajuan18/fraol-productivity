'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  FiPlus,
  FiList,
  FiCheckCircle,
  FiActivity,
  FiXCircle,
  FiCalendar,
  FiClock,
  FiSearch,
  FiTag,
} from 'react-icons/fi';
import { TabNav } from '@/src/components/ui/TabNav';
import { SessionTimer } from './components/SessionTimer';
import { SessionCalendar } from './components/SessionCalendar';
import { SessionHistoryList } from './components/SessionHistoryList';
import { SessionStatsBar, type SessionStatusFilter } from './components/SessionStatsBar';
import { FocusDistribution } from './components/FocusDistribution';
import { getWeekStart, formatLongDate } from '@/src/utils/date';
import { SESSION_PAGE_SIZE } from '@/lib/repositories/ProductivityRepository';
import type { Session } from '@/src/types';

interface TabSessionsProps {
  sessions: Session[];
  onAddSession: (session: Session) => void;
  onUpdateSession: (id: number, data: Partial<Session>) => void;
  onDeleteSession: (id: number) => void;
  taskTypes: string[];
  onAddTaskType: (type: string) => void;
  onRemoveTaskType: (type: string) => void;
  activeSubTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
  loading?: boolean;
}

type SubTab = 'new' | 'history';
type ViewMode = 'calendar' | 'list';
type DateFilter = 'week' | 'month' | 'all';

const STATUS_FILTERS: { id: SessionStatusFilter; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'all', label: 'All', icon: FiList },
  { id: 'completed', label: 'Completed', icon: FiCheckCircle },
  { id: 'in-progress', label: 'In Progress', icon: FiActivity },
  { id: 'missed', label: 'Missed', icon: FiXCircle },
];

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

function matchesDateFilter(dateStr: string, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return true;
  if (filter === 'week') return date >= getWeekStart();
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function matchesStatusFilter(status: Session['status'], filter: SessionStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'completed') return status === 'Completed';
  if (filter === 'in-progress') return status === 'In Progress';
  return status === 'Missed';
}

function matchesCategoryFilter(task: string, filter: string, taskTypes: string[]): boolean {
  if (filter === 'all') return true;
  return task === filter || (taskTypes.includes(task) && task === filter);
}

function matchesSearch(task: string, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return task.toLowerCase().includes(q);
}

export default function TabSessions({
  sessions,
  onAddSession,
  onDeleteSession,
  taskTypes,
  onAddTaskType,
  onRemoveTaskType,
  activeSubTab,
  onSubTabChange,
  loading = false,
}: TabSessionsProps) {
  const reduced = useReducedMotion();
  const [internalSubTab, setInternalSubTab] = useState<SubTab>('new');
  const controlled = activeSubTab !== undefined && onSubTabChange !== undefined;
  const currentSubTab = controlled ? activeSubTab : internalSubTab;
  const setCurrentSubTab = (tab: SubTab) => {
    if (controlled) onSubTabChange(tab);
    else setInternalSubTab(tab);
  };
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startConfig, setStartConfig] = useState<{ task: string; seconds: number } | null>(null);
  const [timerKey, setTimerKey] = useState(0);
  const [historyLimit, setHistoryLimit] = useState(SESSION_PAGE_SIZE);
  const [historyRevealing, setHistoryRevealing] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const revealTimer = useRef<number | null>(null);

  const thisWeekCount = useMemo(() => sessions.filter((s) => matchesDateFilter(s.date, 'week')).length, [sessions]);

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          matchesDateFilter(s.date, dateFilter) &&
          matchesStatusFilter(s.status, statusFilter) &&
          matchesCategoryFilter(s.task, categoryFilter, taskTypes) &&
          matchesSearch(s.task, searchTerm),
      ),
    [sessions, dateFilter, statusFilter, categoryFilter, searchTerm, taskTypes],
  );

  const visibleSessions = useMemo(() => filteredSessions.slice(0, historyLimit), [filteredSessions, historyLimit]);
  const historyHasMore = historyLimit < filteredSessions.length;
  const historyEnded = !historyHasMore && filteredSessions.length > SESSION_PAGE_SIZE;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || historyHasMore === false || historyRevealing) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHistoryRevealing(true);
          revealTimer.current = window.setTimeout(() => {
            revealTimer.current = null;
            setHistoryLimit((l) => l + SESSION_PAGE_SIZE);
            setHistoryRevealing(false);
          }, 350);
        }
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historyHasMore, historyRevealing]);

  useEffect(() => {
    return () => {
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
    };
  }, []);

  const resetHistoryPaging = () => {
    setHistoryLimit(SESSION_PAGE_SIZE);
    setHistoryRevealing(false);
  };

  const handleStatusFilter = (filter: SessionStatusFilter) => {
    setStatusFilter(filter);
    resetHistoryPaging();
  };

  const handleDateFilter = (filter: DateFilter) => {
    setDateFilter(filter);
    resetHistoryPaging();
  };

  const handleCategoryFilter = (filter: string) => {
    setCategoryFilter(filter);
    resetHistoryPaging();
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    resetHistoryPaging();
  };

  const subTabs = useMemo(
    () => [
      { id: 'new', label: 'New Session', icon: FiPlus },
      { id: 'history', label: 'History', icon: FiList, count: sessions.length },
    ],
    [sessions.length],
  );

  const handleStatsFilter = (filter: SessionStatusFilter) => {
    setStatusFilter(filter);
    setCurrentSubTab('history');
  };

  const handleSubTabChange = (id: string) => {
    setCurrentSubTab(id as SubTab);
    if (id === 'new') {
      setStartConfig(null);
      setTimerKey((k) => k + 1);
    }
  };

  const handleStartAgain = (task: string, seconds: number) => {
    setStartConfig({ task, seconds });
    setTimerKey((k) => k + 1);
    setCurrentSubTab('new');
  };

  const handleStartNew = () => {
    setStartConfig(null);
    setTimerKey((k) => k + 1);
    setCurrentSubTab('new');
  };

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.18 }}
        className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{formatLongDate(new Date())}</div>
          <h1 className="mt-1.5 text-[34px] sm:text-[40px] font-semibold leading-[1.1] tracking-[-0.025em] text-text">
            Sessions
          </h1>
          <p className="mt-2 text-[14px] text-text-secondary">Start a focus session and keep track of your history.</p>
        </div>
        <div className="self-start md:self-auto">
          <TabNav tabs={subTabs} activeTab={currentSubTab} onTabChange={handleSubTabChange} />
        </div>
      </motion.header>

      <SessionStatsBar sessions={sessions} onFilterStatus={handleStatsFilter} />

      <AnimatePresence mode="wait">
        {currentSubTab === 'new' ? (
          <motion.div
            key={`new-${timerKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <SessionTimer
              key={`timer-${timerKey}`}
              onSessionComplete={onAddSession}
              taskTypes={taskTypes}
              onAddTaskType={onAddTaskType}
              onRemoveTaskType={onRemoveTaskType}
              onNavigateToHistory={() => setCurrentSubTab('history')}
              initialTask={startConfig?.task}
              initialSeconds={startConfig?.seconds}
            />
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.01em] text-text">Session history</h3>
                <p className="text-sm text-text-muted mt-0.5">
                  {thisWeekCount} session{thisWeekCount !== 1 ? 's' : ''} this week
                </p>
              </div>
              <div className="flex items-center gap-1 bg-surface-hover rounded-xl p-1 border border-border">
                <button
                  onClick={() => setViewMode('list')}
                  className={`h-9 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                    viewMode === 'list' ? 'bg-surface text-text shadow-sm' : 'text-text-secondary hover:text-text'
                  }`}
                  aria-label="List view"
                >
                  <FiList size={15} aria-hidden />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`h-9 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                    viewMode === 'calendar' ? 'bg-surface text-text shadow-sm' : 'text-text-secondary hover:text-text'
                  }`}
                  aria-label="Calendar view"
                >
                  <FiCalendar size={15} aria-hidden />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <TabNav
                tabs={STATUS_FILTERS}
                activeTab={statusFilter}
                onTabChange={(id) => handleStatusFilter(id as SessionStatusFilter)}
                size="sm"
              />
              <div className="flex items-center gap-1 bg-surface-hover rounded-xl p-1 border border-border">
                <FiClock size={13} className="text-text-muted ml-2" aria-hidden />
                {DATE_FILTERS.map((df) => {
                  const isActive = dateFilter === df.id;
                  return (
                    <button
                      key={df.id}
                      onClick={() => handleDateFilter(df.id)}
                      className={`h-8 px-3 rounded-lg text-[13px] font-medium transition-colors ${
                        isActive ? 'bg-surface text-text shadow-sm' : 'text-text-secondary hover:text-text'
                      }`}
                    >
                      {df.label}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-1.5 bg-surface-hover rounded-xl p-1 pl-2.5 border border-border">
                <FiTag size={13} className="text-text-muted" aria-hidden />
                <select
                  value={categoryFilter}
                  onChange={(e) => handleCategoryFilter(e.target.value)}
                  aria-label="Filter by task type"
                  className="h-8 pr-2 pl-1 bg-transparent text-[13px] font-medium text-text-secondary hover:text-text focus:outline-none"
                >
                  <option value="all">All types</option>
                  {taskTypes
                    .filter((t) => t.trim())
                    .map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                </select>
              </label>

              <label className="relative">
                <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search sessions…"
                  aria-label="Search sessions"
                  className="h-9 w-44 rounded-xl border border-border bg-surface-hover pl-8 pr-3 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all"
                />
              </label>
            </div>

            {sessions.length === 0 ? (
              <SessionHistoryList
                sessions={filteredSessions}
                onDeleteSession={onDeleteSession}
                onStartAgain={handleStartAgain}
                onStartNew={handleStartNew}
              />
            ) : filteredSessions.length === 0 ? (
              <div className="card-glass rounded-[22px] p-6 text-center">
                <p className="text-sm text-text-secondary">No sessions match these filters.</p>
                <p className="text-xs text-text-muted mt-1">Try a different status or date range.</p>
              </div>
            ) : viewMode === 'calendar' ? (
              <SessionCalendar sessions={filteredSessions} onDeleteSession={onDeleteSession} />
            ) : (
              <>
                <SessionHistoryList
                  sessions={visibleSessions}
                  onDeleteSession={onDeleteSession}
                  onStartAgain={handleStartAgain}
                  onStartNew={handleStartNew}
                />

                {historyHasMore && (
                  <div className="space-y-2">
                    {historyRevealing && (
                      <div className="card-glass rounded-[22px] divide-y divide-divider overflow-hidden animate-pulse">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="flex items-center gap-3 px-5 py-4">
                            <div className="w-9 h-9 rounded-[10px] bg-surface-hover shrink-0" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3.5 w-48 rounded-full bg-surface-hover" />
                              <div className="h-3 w-28 rounded-full bg-surface-hover/70" />
                            </div>
                            <div className="h-3 w-16 rounded-full bg-surface-hover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div ref={sentinelRef} className="h-px" aria-hidden="true" />
                  </div>
                )}

                {historyEnded && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-text-muted">
                    <FiCheckCircle size={13} className="shrink-0" />
                    <span>You&rsquo;ve reached the end of your session history.</span>
                  </div>
                )}
              </>
            )}

            <FocusDistribution
              sessions={filteredSessions}
              taskTypes={taskTypes}
              statusFilter={statusFilter}
              loading={loading}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
