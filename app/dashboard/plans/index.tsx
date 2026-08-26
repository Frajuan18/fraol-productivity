'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  FiTarget,
  FiCheckCircle,
  FiClock,
  FiList,
  FiCalendar,
  FiRefreshCw,
  FiTag,
  FiPlay,
  FiTrash2,
  FiCircle,
  FiInfo,
  FiMoreHorizontal,
  FiChevronDown,
  FiX,
  FiArrowRight,
  FiPlus,
  FiCheck,
  FiFile,
  FiExternalLink,
} from 'react-icons/fi';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { TabNav } from '@/src/components/ui/TabNav';
import { AnimatedNumber } from '@/src/components/ui/AnimatedNumber';
import { formatLongDate, toIsoDateString, getWeekStart } from '@/src/utils/date';
import { formatFileSize } from './studySchedule';
import type { IconType } from 'react-icons';
import type { Plan, PlanPriority, PlanStatus } from '@/src/types';
import { planFileOpenUrl } from '@/lib/plans/planFileApi';
import PlanFromFileCreator from './PlanFromFileCreator';
import { PlanCard } from '@/src/features/plans/components/PlanCard';

interface TabPlansProps {
  plans: Plan[];
  onAddPlan: (plan: Omit<Plan, 'id' | 'status'>) => void;
  onAddPlanFromFile?: (plan: Plan) => void;
  onUpdatePlan: (id: number, status: PlanStatus) => void;
  onDeletePlan: (id: number) => void;
  onUpdatePlanData?: (id: number, data: Partial<Plan>) => void;
  onNavigateTab?: (tab: string) => void;
  activeSection?: 'plans' | 'history';
  onSectionChange?: (section: 'plans' | 'history') => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const softCard = 'card-glass rounded-[22px] p-6 sm:p-8';
const interactiveCard =
  'hover:-translate-y-px hover:shadow-[var(--card-shadow-hover)] hover:bg-surface-hover/40 transition-all duration-200';

const HISTORY_PAGE_SIZE = 30;

const statusConfig: Record<PlanStatus, { color: string; bg: string; icon: IconType; label: string }> = {
  completed: { color: 'text-success', bg: 'bg-success/10', icon: FiCheckCircle, label: 'Completed' },
  'in-progress': { color: 'text-warning', bg: 'bg-warning/10', icon: FiRefreshCw, label: 'In Progress' },
  pending: { color: 'text-info', bg: 'bg-info/10', icon: FiClock, label: 'Pending' },
  'not-started': { color: 'text-text-muted', bg: 'bg-surface-hover', icon: FiCircle, label: 'Not Started' },
};

function priorityChipClass(priority: PlanPriority): string {
  switch (priority) {
    case 'high':
      return 'bg-danger/10 text-danger border border-danger/15';
    case 'medium':
      return 'bg-warning/10 text-warning border border-warning/15';
    default:
      return 'bg-info/10 text-info border border-info/15';
  }
}

function weekdayLong(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
}

function SectionTitle({
  icon: Icon,
  title,
  right,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon size={18} className="text-text-secondary" />
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
      </div>
      {right}
    </div>
  );
}

function ProgressBar({ value, reduced }: { value: number; reduced: boolean | null }) {
  return (
    <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: reduced ? 0 : 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

interface PlanRowProps {
  plan: Plan;
  onStatusChange: (plan: Plan, status: PlanStatus) => void;
  onDeletePlan: (id: number) => void;
  onOpenFile?: (plan: Plan) => void;
  showDate?: boolean;
}

function PlanRow({ plan, onStatusChange, onDeletePlan, onOpenFile, showDate = false }: PlanRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduced = useReducedMotion();
  const done = plan.status === 'completed';
  const todayIso = toIsoDateString(new Date());

  const menuActions: { label: string; icon: IconType; cls: string; fn: () => void }[] = [
    ...(plan.status !== 'completed'
      ? [
          {
            label: 'Mark complete',
            icon: FiCheckCircle,
            cls: 'text-success hover:bg-success/10',
            fn: () => onStatusChange(plan, 'completed'),
          },
        ]
      : []),
    ...(plan.status !== 'in-progress' && plan.status !== 'completed'
      ? [
          {
            label: 'Start progress',
            icon: FiRefreshCw,
            cls: 'text-warning hover:bg-warning/10',
            fn: () => onStatusChange(plan, 'in-progress'),
          },
        ]
      : []),
    ...(plan.status !== 'pending'
      ? [
          {
            label: 'Set pending',
            icon: FiClock,
            cls: 'text-info hover:bg-info/10',
            fn: () => onStatusChange(plan, 'pending'),
          },
        ]
      : []),
    ...(plan.file && onOpenFile
      ? [
          {
            label: 'Open document',
            icon: FiExternalLink,
            cls: 'text-accent hover:bg-accent-muted',
            fn: () => onOpenFile(plan),
          },
        ]
      : []),
    { label: 'Delete', icon: FiTrash2, cls: 'text-danger hover:bg-danger/10', fn: () => onDeletePlan(plan.id) },
  ];

  const closeMenu = () => setMenuOpen(false);

  return (
    <li className="group rounded-lg -mx-2 px-2 py-3 first:pt-0 last:pb-0 hover:bg-surface-hover/50 transition-colors duration-200">
      <div className="flex items-start gap-3">
        <button
          onClick={() => onStatusChange(plan, done ? 'pending' : 'completed')}
          aria-label={done ? `Mark "${plan.title}" as pending` : `Mark "${plan.title}" as completed`}
          className="mt-0.5 shrink-0 flex items-center justify-center text-border-hover hover:text-accent transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-full"
        >
          {done ? <FiCheckCircle className="text-accent" size={20} /> : <FiCircle size={20} />}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <span className={`text-[15px] ${done ? 'line-through text-text-muted' : 'text-text'}`}>{plan.title}</span>
            <FiChevronDown
              size={15}
              className={`shrink-0 mt-1 text-text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {showDate && (
              <span className="inline-flex items-center gap-1 text-[10px] text-text-muted bg-surface-hover px-2 py-0.5 rounded-full border border-border">
                <FiCalendar size={9} />
                {plan.date === todayIso ? 'Today' : plan.date}
              </span>
            )}
            {plan.category && (
              <span className="inline-flex items-center gap-1 text-[10px] text-text-muted bg-surface-hover px-2 py-0.5 rounded-full border border-border">
                <FiTag size={9} />
                {plan.category}
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-muted">
              {plan.type}
            </span>
            {plan.file && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent-muted border border-accent/20 text-accent">
                <FiFile size={9} />
                {plan.file.originalName}
              </span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${priorityChipClass(plan.priority)}`}>
              {plan.priority}
            </span>
          </div>
        </button>

        <div className="relative shrink-0 self-start mt-0.5">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for "${plan.title}"`}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiMoreHorizontal size={16} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={closeMenu} aria-hidden="true" />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -2 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -2 }}
                  transition={{ duration: reduced ? 0 : 0.14, ease: 'easeOut' }}
                  role="menu"
                  className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-border bg-surface-raised shadow-[var(--card-shadow-hover)] p-1"
                >
                  {menuActions.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <button
                        key={action.label}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          closeMenu();
                          action.fn();
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 h-9 rounded-lg text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${action.cls}`}
                      >
                        <ActionIcon size={14} />
                        {action.label}
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-1 pb-5 pl-[38px] border-t border-divider">
              {plan.description ? (
                <p className="text-[13px] leading-6 text-text-secondary whitespace-pre-line">{plan.description}</p>
              ) : (
                <p className="text-xs leading-6 text-text-muted">No additional details.</p>
              )}
              {plan.file && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-surface-hover/60 p-3">
                  <span className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
                    <FiFile className="text-accent" size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-text truncate">{plan.file.originalName}</div>
                    <div className="text-[11px] text-text-muted mt-0.5 truncate">
                      {plan.file.mimeType.split('/')[1]?.toUpperCase() ?? 'Document'} · {formatFileSize(plan.file.size)}
                      {plan.file.pageCount != null ? ` · ${plan.file.pageCount} pages` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenFile?.(plan)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-contrast px-3 h-8 text-xs font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                  >
                    <FiExternalLink size={12} /> Open
                  </button>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {menuActions.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.fn}
                      className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${action.cls}`}
                    >
                      <ActionIcon size={12} />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

interface UndoToastState {
  planId: number;
  title: string;
  prevStatus: PlanStatus;
}

export default function TabPlans({
  plans,
  onAddPlan,
  onAddPlanFromFile,
  onUpdatePlan,
  onDeletePlan,
  onNavigateTab,
  activeSection,
  onSectionChange,
}: TabPlansProps) {
  const reduced = useReducedMotion();
  const [activeTab, setActiveTab] = useState<'plans' | 'history'>('plans');
  const controlledSection = activeSection !== undefined && onSectionChange !== undefined;
  const section = controlledSection ? activeSection : activeTab;
  const setSection = (s: 'plans' | 'history') => {
    if (controlledSection) onSectionChange(s);
    else setActiveTab(s);
  };
  const [historyFilter, setHistoryFilter] = useState<'all' | PlanStatus>('all');
  const [historyDayFilter, setHistoryDayFilter] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [openRequest, setOpenRequest] = useState(0);
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const [historyRevealing, setHistoryRevealing] = useState(false);
  const historySentinelRef = useRef<HTMLDivElement | null>(null);
  const historyRevealTimer = useRef<number | null>(null);

  function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const openPlanFile = useCallback((plan: Plan) => {
    if (!plan.file) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const isPdf = plan.file.mimeType === 'application/pdf';
    const fileName = plan.file.originalName;
    void (async () => {
      try {
        const res = await fetch(planFileOpenUrl(plan.id));
        if (!res.ok) throw new Error(`Failed to open file (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (isPdf) {
          win.document.write(
            `<!doctype html><html><head><title>${escapeHtml(fileName)}</title></head>` +
              `<body style="margin:0"><embed src="${url}" type="application/pdf" style="width:100vw;height:100vh"></body></html>`,
          );
          win.document.close();
        } else {
          win.location.href = url;
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) {
        console.error('Failed to open plan file:', error);
        win.close();
      }
    })();
  }, []);

  const todayIso = useMemo(() => toIsoDateString(new Date()), []);
  const weekStart = useMemo(() => getWeekStart(), []);
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return end;
  }, [weekStart]);
  const weekStartIso = toIsoDateString(weekStart);
  const weekEndIso = toIsoDateString(weekEnd);
  const weekRangeLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} \u2013 ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

  const thisWeekPlans = useMemo(
    () =>
      plans.filter((p) => p.date >= weekStartIso && p.date <= weekEndIso).sort((a, b) => a.date.localeCompare(b.date)),
    [plans, weekStartIso, weekEndIso],
  );
  const todayPlans = useMemo(() => plans.filter((p) => p.date === todayIso), [plans, todayIso]);
  const historyPlans = useMemo(() => plans, [plans]);
  const activeCount = useMemo(() => plans.filter((p) => p.status !== 'completed').length, [plans]);
  const sortedPlans = useMemo(
    () => [...plans.filter((p) => p.status !== 'completed'), ...plans.filter((p) => p.status === 'completed')],
    [plans],
  );

  const countByStatus = useMemo(
    () => (list: Plan[]) => ({
      completed: list.filter((p) => p.status === 'completed').length,
      inProgress: list.filter((p) => p.status === 'in-progress').length,
      pending: list.filter((p) => p.status === 'pending').length,
      notStarted: list.filter((p) => p.status === 'not-started').length,
      total: list.length,
    }),
    [],
  );

  const weekCounts = countByStatus(thisWeekPlans);
  const todayCounts = countByStatus(todayPlans);
  const weekCompletionRate = weekCounts.total > 0 ? Math.round((weekCounts.completed / weekCounts.total) * 100) : 0;
  const remainingThisWeek = weekCounts.total - weekCounts.completed;

  const nextPlan = useMemo(() => {
    const order: PlanStatus[] = ['in-progress', 'pending', 'not-started'];
    for (const status of order) {
      const found = thisWeekPlans.find((p) => p.status === status);
      if (found) return found;
    }
    return null;
  }, [thisWeekPlans]);

  const weekDays = useMemo(() => {
    return DAYS.map((label, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const iso = toIsoDateString(d);
      const dayPlans = plans.filter((p) => p.date === iso);
      return {
        label,
        date: iso,
        count: dayPlans.length,
        completed: dayPlans.filter((p) => p.status === 'completed').length,
        isToday: iso === todayIso,
      };
    });
  }, [plans, weekStart, todayIso]);

  const weekMaxCount = Math.max(...weekDays.map((d) => d.count), 1);

  const selectedDayInfo = useMemo(
    () => (selectedDay ? (weekDays.find((d) => d.date === selectedDay) ?? null) : null),
    [selectedDay, weekDays],
  );

  function handleStatusChange(plan: Plan, status: PlanStatus) {
    const prev = plan.status;
    onUpdatePlan(plan.id, status);
    if (status === 'completed' && prev !== 'completed') {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setUndoToast({ planId: plan.id, title: plan.title, prevStatus: prev });
      toastTimerRef.current = window.setTimeout(() => {
        setUndoToast(null);
        toastTimerRef.current = null;
      }, 3000);
    }
  }

  function undoComplete() {
    if (!undoToast) return;
    onUpdatePlan(undoToast.planId, undoToast.prevStatus);
    setUndoToast(null);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  function toggleHistoryStatus(status: PlanStatus | null) {
    setHistoryFilter((prev) => (status === null ? 'all' : prev === status ? 'all' : status));
    setHistoryDayFilter(null);
    setHistoryLimit(HISTORY_PAGE_SIZE);
  }

  function viewSelectedDay() {
    if (!selectedDay) return;
    setHistoryDayFilter(selectedDay);
    setHistoryFilter('all');
    setHistoryLimit(HISTORY_PAGE_SIZE);
    requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }

  function clearFilters() {
    setHistoryDayFilter(null);
    setHistoryFilter('all');
    setHistoryLimit(HISTORY_PAGE_SIZE);
  }

  useEffect(() => {
    return () => {
      if (historyRevealTimer.current) window.clearTimeout(historyRevealTimer.current);
    };
  }, []);

  function createPlan() {
    clearFilters();
    setSelectedDay(null);
    setSection('plans');
    setOpenRequest((n) => n + 1);
    requestAnimationFrame(() => {
      document
        .getElementById('create-plan-card')
        ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }

  const filteredHistoryPlans = useMemo(() => {
    let list = historyPlans;
    if (historyDayFilter) list = list.filter((p) => p.date === historyDayFilter);
    if (historyFilter !== 'all') list = list.filter((p) => p.status === historyFilter);
    return list;
  }, [historyPlans, historyDayFilter, historyFilter]);

  const historyBuckets = useMemo(() => {
    const sliced = filteredHistoryPlans.slice(0, historyLimit);
    const buckets: { id: 'today' | 'week' | 'earlier'; label: string; dates: { date: string; plans: Plan[] }[] }[] = [
      { id: 'today', label: 'Today', dates: [] },
      { id: 'week', label: 'This week', dates: [] },
      { id: 'earlier', label: 'Earlier', dates: [] },
    ];
    const map = new Map<'today' | 'week' | 'earlier', Map<string, Plan[]>>();
    for (const p of sliced) {
      const bucketId: 'today' | 'week' | 'earlier' =
        p.date === todayIso ? 'today' : p.date >= weekStartIso ? 'week' : 'earlier';
      let inner = map.get(bucketId);
      if (!inner) {
        inner = new Map();
        map.set(bucketId, inner);
      }
      const arr = inner.get(p.date) ?? [];
      arr.push(p);
      inner.set(p.date, arr);
    }
    return buckets
      .filter((b) => map.has(b.id))
      .map((b) => ({
        ...b,
        dates: Array.from(map.get(b.id)!.entries())
          .sort((a, c) => c[0].localeCompare(a[0]))
          .map(([date, datePlans]) => ({ date, plans: datePlans })),
      }));
  }, [filteredHistoryPlans, todayIso, weekStartIso, historyLimit]);

  const historyHasMore = historyLimit < filteredHistoryPlans.length;

  useEffect(() => {
    const sentinel = historySentinelRef.current;
    if (!sentinel || !historyHasMore || historyRevealing) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setHistoryRevealing(true);
          historyRevealTimer.current = window.setTimeout(() => {
            historyRevealTimer.current = null;
            setHistoryLimit((l) => l + HISTORY_PAGE_SIZE);
            setHistoryRevealing(false);
          }, 350);
        }
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historyHasMore, historyRevealing]);

  const summaryCards: {
    label: string;
    value: number;
    icon: IconType;
    iconClass: string;
    sub: string;
    status: PlanStatus | null;
  }[] = [
    {
      label: "This week's plans",
      value: weekCounts.total,
      icon: FiTarget,
      iconClass: 'text-accent',
      sub: `${weekCounts.completed} completed`,
      status: null,
    },
    {
      label: 'Completed',
      value: weekCounts.completed,
      icon: FiCheckCircle,
      iconClass: 'text-success',
      sub: `${weekCompletionRate}% rate`,
      status: 'completed',
    },
    {
      label: 'In Progress',
      value: weekCounts.inProgress,
      icon: FiRefreshCw,
      iconClass: 'text-warning',
      sub: weekCounts.inProgress > 0 ? 'Active now' : 'Nothing active',
      status: 'in-progress',
    },
    {
      label: 'Pending',
      value: weekCounts.pending,
      icon: FiClock,
      iconClass: 'text-info',
      sub: weekCounts.pending > 0 ? 'Awaiting start' : 'Nothing pending',
      status: 'pending',
    },
  ];

  const historyFilters: { id: 'all' | PlanStatus; label: string; icon: IconType }[] = [
    { id: 'all', label: 'All', icon: FiList },
    { id: 'completed', label: 'Completed', icon: FiCheckCircle },
    { id: 'in-progress', label: 'In Progress', icon: FiRefreshCw },
    { id: 'pending', label: 'Pending', icon: FiClock },
    { id: 'not-started', label: 'Not Started', icon: FiCircle },
  ];

  const sectionTabs = [
    { id: 'plans', label: 'Plans', icon: FiTarget },
    { id: 'history', label: 'History', icon: FiList, count: historyPlans.length },
  ];

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.18, delay: reduced ? 0 : delay },
  });

  return (
    <div className="space-y-8">
      {/* ===== Header ===== */}
      <motion.header {...fade(0)} className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{formatLongDate(new Date())}</div>
          <h1 className="mt-1.5 text-[34px] sm:text-[40px] font-semibold leading-[1.1] tracking-[-0.025em] text-text">
            {section === 'history' ? 'History' : 'Plans'}
          </h1>
          <p className="mt-2 text-[14px] text-text-secondary">
            {section === 'history'
              ? 'Every plan you have created, organised by when they were scheduled.'
              : 'Create plans that turn your goals into clear, focused progress.'}
          </p>
          <div className="mt-2.5 flex items-center gap-2 text-[13px] text-text-muted">
            <span className="font-medium text-text-secondary tabular-nums">
              {section === 'history'
                ? `${historyPlans.length} total plan${historyPlans.length !== 1 ? 's' : ''}`
                : `${activeCount} active plan${activeCount !== 1 ? 's' : ''}`}
            </span>
            <span aria-hidden="true" className="text-border-hover">
              ·
            </span>
            <span>
              {section === 'history'
                ? 'Everything you have created.'
                : activeCount === 0
                  ? 'Start with one clear goal.'
                  : 'Keep your momentum going.'}
            </span>
          </div>
        </div>
        <div className="self-start md:self-auto">
          <TabNav
            tabs={sectionTabs}
            activeTab={section}
            onTabChange={(tab) => {
              setSection(tab as 'plans' | 'history');
              setHistoryLimit(HISTORY_PAGE_SIZE);
            }}
          />
        </div>
      </motion.header>

      <AnimatePresence>
        {undoToast && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-border bg-surface-raised px-4 py-2.5 shadow-[var(--card-shadow-hover)]"
          >
            <FiCheckCircle className="text-success shrink-0" size={16} />
            <span className="text-[13px] text-text truncate max-w-[50vw] sm:max-w-sm">
              &ldquo;{undoToast.title}&rdquo; marked complete
            </span>
            <button
              onClick={undoComplete}
              className="shrink-0 text-[13px] font-semibold text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg px-2 py-1"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {section === 'plans' ? (
          <motion.div
            key="plans"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="space-y-8"
          >
            {/* ===== Create a plan ===== */}
            <motion.section {...fade(0.05)} id="create-plan-card" className="scroll-mt-6">
              <PlanFromFileCreator
                onAddPlan={onAddPlan}
                onAddPlanFromFile={onAddPlanFromFile ?? (() => {})}
                openRequest={openRequest}
              />
            </motion.section>

            {/* ===== Your plans ===== */}
            <motion.section {...fade(0.12)}>
              <SectionTitle
                icon={FiTarget}
                title="Your plans"
                right={
                  plans.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSection('history');
                        setHistoryLimit(HISTORY_PAGE_SIZE);
                      }}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg px-2 py-1"
                    >
                      View all <FiArrowRight size={13} />
                    </button>
                  ) : undefined
                }
              />
              <p className="mt-1.5 text-[13px] text-text-muted">
                Plans help you turn important goals into focused sessions.
              </p>

              {plans.length === 0 ? (
                <div className={`${softCard} mt-4 flex flex-col items-center text-center`}>
                  <span className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                    <FiTarget size={20} className="text-text-muted" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-text">No plans yet</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted max-w-[360px]">
                    Create your first plan to turn an important goal into focused progress.
                  </p>
                  <button
                    type="button"
                    onClick={createPlan}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-[12px] bg-accent hover:bg-accent-hover text-accent-contrast px-4 h-10 text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                  >
                    <FiPlus size={14} /> Create your first plan
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {sortedPlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onUpdateStatus={(id, status) => onUpdatePlan(id, status)}
                      onDelete={onDeletePlan}
                      onOpen={() => {
                        clearFilters();
                        setSection('history');
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.section>
          </motion.div>
        ) : (
          /* ===== History ===== */
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="space-y-8"
          >
            {/* ===== This week hero + Today ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <motion.section {...fade(0.05)} className="lg:col-span-7">
                <div className={`${softCard} ${interactiveCard} h-full`}>
                  <SectionTitle
                    icon={FiTarget}
                    title="This week"
                    right={<span className="text-[11px] text-text-muted tabular-nums">{weekRangeLabel}</span>}
                  />

                  <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
                    <div>
                      <div className="text-[44px] sm:text-[52px] font-semibold leading-none tracking-[-0.02em] text-text tabular-nums">
                        <AnimatedNumber value={weekCounts.completed} />
                        <span className="text-[24px] font-medium text-text-secondary"> / {weekCounts.total}</span>
                      </div>
                      <div className="mt-2.5 text-sm text-text-secondary">plans complete this week</div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-[28px] font-semibold tracking-tight tabular-nums ${weekCounts.total > 0 ? 'text-success' : 'text-text-muted'}`}
                      >
                        {weekCompletionRate}%
                      </div>
                      <div className="mt-0.5 text-xs text-text-muted">completion</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={weekCompletionRate} reduced={reduced} />
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div>
                      <div className="text-[15px] font-medium text-text">
                        {todayCounts.total} plan{todayCounts.total !== 1 ? 's' : ''} today
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {todayCounts.total > 0
                          ? `${todayCounts.completed} completed \u00b7 ${todayCounts.total - todayCounts.completed} remaining`
                          : 'Nothing scheduled for today'}
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-[15px] font-semibold text-text tabular-nums">{remainingThisWeek}</div>
                        <div className="text-[10px] text-text-muted">left this week</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[15px] font-semibold text-text tabular-nums">{weekCounts.notStarted}</div>
                        <div className="text-[10px] text-text-muted">not started</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-divider">
                    <div className="flex items-end gap-1.5 sm:gap-2 h-20 border-b border-divider/70">
                      {weekDays.map((d, i) => {
                        const isToday = d.isToday;
                        const barHeight = Math.max(6, (d.count / weekMaxCount) * 58);
                        const hasPlans = d.count > 0;
                        const allDone = hasPlans && d.completed === d.count;
                        const isSelected = selectedDay === d.date;
                        return (
                          <button
                            key={d.date}
                            type="button"
                            onClick={() => setSelectedDay(isSelected ? null : d.date)}
                            aria-pressed={isSelected}
                            aria-label={`${d.label} — ${d.count} plan${d.count !== 1 ? 's' : ''}${hasPlans ? `, ${d.completed} completed` : ''}${isToday ? ', today' : ''}${isSelected ? ', selected' : ''}`}
                            className="group relative flex-1 flex flex-col items-center justify-end h-full outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-lg"
                          >
                            {hasPlans && (
                              <span
                                className={`mb-1 text-[10px] font-medium tabular-nums transition-colors duration-150 ${
                                  isSelected ? 'text-accent' : isToday ? 'text-accent/80' : 'text-text-muted'
                                }`}
                              >
                                {d.count}
                              </span>
                            )}
                            <motion.span
                              initial={reduced ? { height: barHeight } : { height: 0 }}
                              animate={{ height: barHeight }}
                              transition={{
                                duration: reduced ? 0 : 0.5,
                                ease: 'easeOut',
                                delay: reduced ? 0 : i * 0.05,
                              }}
                              className={`relative w-full max-w-[26px] rounded-t-[5px] transition-colors duration-150 ${
                                isSelected
                                  ? 'bg-gradient-to-t from-accent to-accent-hover shadow-[0_1px_3px_rgba(0,0,0,0.2)]'
                                  : hasPlans
                                    ? allDone
                                      ? 'bg-gradient-to-t from-accent/80 to-accent/55'
                                      : 'bg-gradient-to-t from-accent/50 to-accent/30'
                                    : 'bg-surface-hover'
                              }`}
                            >
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-lg border border-border bg-surface-raised px-2 py-1 text-[10px] text-text-secondary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 shadow-[var(--card-shadow)] z-10">
                                {d.label} · {d.count} plan{d.count !== 1 ? 's' : ''}
                                {hasPlans ? `, ${d.completed} completed` : ''}
                              </span>
                            </motion.span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] mt-2">
                      {weekDays.map((d) => (
                        <span
                          key={d.date}
                          className={`flex items-center gap-1 transition-colors duration-150 ${
                            d.isToday ? 'text-accent font-medium' : 'text-text-muted'
                          }`}
                        >
                          {d.isToday && <span className="w-1 h-1 rounded-full bg-warning" />}
                          {d.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {selectedDayInfo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: reduced ? 0 : 0.22, ease: 'easeOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-hover/50 px-3 py-2.5">
                          <div className="flex items-center gap-2 text-xs text-text-secondary min-w-0">
                            <FiCalendar size={13} className="text-accent shrink-0" />
                            <span className="truncate">
                              {weekdayLong(selectedDayInfo.date)} · {selectedDayInfo.count} plan
                              {selectedDayInfo.count !== 1 ? 's' : ''}
                              {selectedDayInfo.count > 0 ? `, ${selectedDayInfo.completed} completed` : ' scheduled'}
                            </span>
                          </div>
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              onClick={viewSelectedDay}
                              className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold text-accent hover:bg-accent-muted transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                            >
                              View {weekdayLong(selectedDayInfo.date)}&rsquo;s plans <FiArrowRight size={12} />
                            </button>
                            <button
                              onClick={() => setSelectedDay(null)}
                              aria-label="Clear day selection"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                            >
                              <FiX size={13} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-6 pt-5 border-t border-divider flex flex-wrap gap-x-5 gap-y-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-text-secondary">
                        Completed <strong className="text-text tabular-nums">{weekCounts.completed}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-warning" />
                      <span className="text-text-secondary">
                        In progress <strong className="text-text tabular-nums">{weekCounts.inProgress}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-info" />
                      <span className="text-text-secondary">
                        Pending <strong className="text-text tabular-nums">{weekCounts.pending}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-border" />
                      <span className="text-text-secondary">
                        Not started <strong className="text-text tabular-nums">{weekCounts.notStarted}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.section>

              <motion.section {...fade(0.1)} className="lg:col-span-5">
                <div className={`${softCard} h-full flex flex-col`}>
                  <SectionTitle
                    icon={FiCalendar}
                    title="Today"
                    right={<span className="text-[11px] text-text-muted">{formatLongDate(new Date())}</span>}
                  />

                  {todayPlans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center flex-1 py-8">
                      <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                        <FiCalendar className="text-text-muted" size={20} />
                      </div>
                      <p className="mt-4 text-[15px] text-text-secondary">Nothing scheduled today.</p>
                      <button
                        onClick={createPlan}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-[12px] border border-border bg-surface-hover/60 hover:bg-surface-hover px-3.5 h-9 text-[13px] font-medium text-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                      >
                        <FiPlus size={13} /> Create a plan
                      </button>
                    </div>
                  ) : (
                    <ul className="mt-4 divide-y divide-divider">
                      {todayPlans.map((plan) => (
                        <PlanRow
                          key={plan.id}
                          plan={plan}
                          onStatusChange={handleStatusChange}
                          onDeletePlan={onDeletePlan}
                          onOpenFile={openPlanFile}
                          showDate
                        />
                      ))}
                    </ul>
                  )}

                  {nextPlan && (
                    <div className="mt-auto pt-5 border-t border-divider mt-6">
                      <div className="text-xs text-text-muted mb-2">Next up</div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${statusConfig[nextPlan.status].bg}`}
                        >
                          {(() => {
                            const NextIcon = statusConfig[nextPlan.status].icon;
                            return <NextIcon size={16} className={statusConfig[nextPlan.status].color} />;
                          })()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] text-text truncate">{nextPlan.title}</div>
                          <div className="text-xs text-text-muted mt-0.5">
                            {nextPlan.category ? `${nextPlan.category} \u00b7 ` : ''}
                            {statusConfig[nextPlan.status].label}
                          </div>
                        </div>
                        <button
                          onClick={() => onNavigateTab?.('sessions')}
                          className="shrink-0 inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast rounded-[12px] px-3.5 h-9 text-[13px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                        >
                          <FiPlay size={13} className="fill-current" /> Focus
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>
            </div>

            {/* ===== Connected status cards ===== */}
            <motion.section {...fade(0.15)}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {summaryCards.map((card) => {
                  const Icon = card.icon;
                  const isActive = historyFilter === (card.status ?? 'all');
                  const base = `card-glass rounded-[20px] p-5 text-left relative overflow-hidden ${interactiveCard} ${
                    isActive ? 'ring-2 ring-accent/40 border-accent/50' : ''
                  }`;
                  return (
                    <button
                      key={card.label}
                      type="button"
                      onClick={() => toggleHistoryStatus(card.status)}
                      aria-pressed={isActive}
                      className={base}
                    >
                      <span className="text-xs font-medium text-text-secondary">{card.label}</span>
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <span className="text-[26px] font-semibold tracking-tight text-text tabular-nums leading-none">
                          <AnimatedNumber value={card.value} />
                        </span>
                        <span className={card.iconClass}>
                          <Icon size={15} />
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs text-text-muted">{card.sub}</div>
                      <div
                        className={`mt-2 flex items-center gap-1 text-[10px] ${isActive ? 'text-accent' : 'text-text-muted'}`}
                      >
                        {isActive ? <FiCheck size={11} /> : <FiArrowRight size={11} />}
                        {isActive ? 'Filtering · tap to clear' : 'Tap to filter'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            {/* Filters */}
            <motion.section {...fade(0.2)}>
              <div
                role="group"
                aria-label="Filter history by status"
                className="flex items-center gap-1 bg-surface-hover rounded-xl p-1 border border-border w-fit flex-wrap"
              >
                {historyFilters.map((filter) => {
                  const Icon = filter.icon;
                  const active = historyFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setHistoryFilter(filter.id);
                        setHistoryDayFilter(null);
                        setHistoryLimit(HISTORY_PAGE_SIZE);
                      }}
                      className={`flex items-center gap-1.5 rounded-lg px-3 h-10 text-[13px] font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${
                        active ? 'bg-surface text-text shadow-sm' : 'text-text-secondary hover:text-text'
                      }`}
                    >
                      <Icon size={13} />
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {(historyDayFilter || historyFilter !== 'all') && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {historyDayFilter && (
                    <button
                      onClick={() => {
                        setHistoryDayFilter(null);
                        setHistoryLimit(HISTORY_PAGE_SIZE);
                      }}
                      aria-label="Clear day filter"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-hover px-2.5 py-1 text-[11px] text-text-secondary hover:text-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                    >
                      <FiCalendar size={11} className="text-accent" />
                      {formatLongDate(new Date(`${historyDayFilter}T00:00:00`))}
                      <FiX size={11} />
                    </button>
                  )}
                  {historyFilter !== 'all' && (
                    <button
                      onClick={() => {
                        setHistoryFilter('all');
                        setHistoryLimit(HISTORY_PAGE_SIZE);
                      }}
                      aria-label="Clear status filter"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-hover px-2.5 py-1 text-[11px] text-text-secondary hover:text-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                    >
                      {(() => {
                        const StatusIcon = statusConfig[historyFilter].icon;
                        return <StatusIcon size={11} className={statusConfig[historyFilter].color} />;
                      })()}
                      {statusConfig[historyFilter].label}
                      <FiX size={11} />
                    </button>
                  )}
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </motion.section>

            {/* History list */}
            <motion.section {...fade(0.25)} ref={listRef}>
              <div className={`${softCard} ${interactiveCard}`}>
                <SectionTitle
                  icon={FiList}
                  title="All plans"
                  right={
                    filteredHistoryPlans.length > 0 ? (
                      <span className="text-[13px] text-text-secondary tabular-nums">
                        {filteredHistoryPlans.length} plan{filteredHistoryPlans.length !== 1 ? 's' : ''}
                      </span>
                    ) : undefined
                  }
                />

                {filteredHistoryPlans.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-10">
                    <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center">
                      <FiInfo className="text-text-muted" size={20} />
                    </div>
                    <p className="mt-4 text-[15px] text-text-secondary">
                      {historyPlans.length === 0 ? 'No plans yet.' : 'No plans match this filter.'}
                    </p>
                    <p className="mt-1 text-sm text-text-muted">
                      {historyPlans.length === 0
                        ? 'Create your first plan to get started.'
                        : 'Try selecting a different filter above.'}
                    </p>
                    {historyPlans.length === 0 && (
                      <button
                        onClick={createPlan}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-[12px] bg-accent hover:bg-accent-hover text-accent-contrast px-4 h-9 text-[13px] font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                      >
                        <FiPlus size={13} /> Create a plan
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-6">
                    {historyBuckets.map((bucket) => (
                      <div key={bucket.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-medium text-text">{bucket.label}</span>
                          <span className="text-[11px] text-text-muted tabular-nums">
                            {bucket.dates.reduce((acc, d) => acc + d.plans.length, 0)}
                          </span>
                        </div>
                        {bucket.dates.map(({ date, plans: datePlans }) => (
                          <div key={date}>
                            <div className="flex items-center justify-between px-2 py-1">
                              <div className="text-[11px] text-text-muted">
                                {formatLongDate(new Date(`${date}T00:00:00`))}
                              </div>
                              <span className="text-[11px] text-text-muted tabular-nums">{datePlans.length}</span>
                            </div>
                            <ul className="divide-y divide-divider border-t border-divider">
                              {datePlans.map((plan) => (
                                <PlanRow
                                  key={plan.id}
                                  plan={plan}
                                  onStatusChange={handleStatusChange}
                                  onDeletePlan={onDeletePlan}
                                  onOpenFile={openPlanFile}
                                />
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ))}
                    {historyHasMore && (
                      <div className="space-y-2">
                        {historyRevealing && (
                          <div className="mt-4 h-2 w-20 rounded-full bg-surface-hover animate-pulse" />
                        )}
                        <div ref={historySentinelRef} className="h-px" aria-hidden="true" />
                      </div>
                    )}
                    {!historyHasMore && filteredHistoryPlans.length > HISTORY_PAGE_SIZE && (
                      <div className="flex items-center justify-center gap-2 py-1 text-xs text-text-muted">
                        <FiCheck className="shrink-0" size={13} />
                        <span>Showing all {filteredHistoryPlans.length} plans</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
