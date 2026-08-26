'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  FiPlay,
  FiPause,
  FiRotateCcw,
  FiPlus,
  FiEdit3,
  FiCheckCircle,
  FiBookmark,
  FiSearch,
  FiMinus,
  FiX,
  FiCheck,
  FiTrash2,
  FiList,
  FiZap,
  FiCode,
  FiBookOpen,
  FiPenTool,
  FiLayout,
  FiBook,
  FiCalendar,
} from 'react-icons/fi';
import { useTimer, partsToSeconds } from '@/src/hooks/useTimer';
import { PRESET_DURATIONS, QUICK_TASKS, DEFAULT_TASK } from '@/src/constants';
import { formatSecondsAsDuration } from '@/src/utils/time';
import type { Session } from '@/src/types';

const ADD_TIME_OPTIONS = [
  { label: '+5m', seconds: 300 },
  { label: '+10m', seconds: 600 },
  { label: '+15m', seconds: 900 },
];

const SAVED_SETUPS_KEY = 'mywhiteboard-saved-setups';

interface SavedSetup {
  id: string;
  task: string;
  seconds: number;
}

interface Feedback {
  text: string;
  tone: 'success' | 'neutral' | 'warning';
}

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function describeDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h} hour${h > 1 ? 's' : ''} ${m} minute${m > 1 ? 's' : ''}`;
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
  if (m > 0) return `${m} minute${m > 1 ? 's' : ''}`;
  return `${totalSeconds} seconds`;
}

function startLabel(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'Start session';
  if (totalSeconds % 3600 === 0) return `Start ${totalSeconds / 3600}-hour session`;
  if (totalSeconds % 60 === 0) return `Start ${totalSeconds / 60}-minute session`;
  return 'Start custom session';
}

function summaryLabel(totalSeconds: number): string {
  if (totalSeconds <= 0) return describeDuration(totalSeconds);
  if (totalSeconds % 3600 === 0) return `${totalSeconds / 3600}-hour`;
  if (totalSeconds % 60 === 0) return `${totalSeconds / 60}-minute`;
  return describeDuration(totalSeconds);
}

function shortDurationLabel(totalSeconds: number): string {
  const hours = totalSeconds / 3600;
  if (hours >= 1 && Number.isInteger(hours)) return `${hours}h`;
  if (hours === 1.5) return '1.5h';
  const m = totalSeconds / 60;
  return `${Number.isInteger(m) ? m : Math.round(m)}m`;
}

const TASK_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'Deep Work': FiZap,
  Coding: FiCode,
  Reading: FiBookOpen,
  Writing: FiPenTool,
  Design: FiLayout,
  Research: FiSearch,
  Learning: FiBook,
  Planning: FiCalendar,
};

const FLIP_CARD_HEIGHT = 56;
const FLIP_CARD_WIDTH = 34;
const FLIP_FONT_SIZE = 66;

const digitStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: FLIP_CARD_HEIGHT,
  fontSize: FLIP_FONT_SIZE,
  fontWeight: 700,
  lineHeight: 1,
  fontFamily: 'var(--font-bebas)',
  letterSpacing: '0.01em',
};

function FlipDigit({ value }: { value: string }) {
  const reduced = useReducedMotion();
  return (
    <span
      className="relative inline-block overflow-hidden select-none"
      style={{ height: FLIP_CARD_HEIGHT, width: FLIP_CARD_WIDTH, perspective: 220 }}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          className="absolute inset-0 will-change-transform"
          style={{ ...digitStyle, transformPerspective: 220 }}
          initial={{ y: '90%', rotateX: -70, opacity: 0 }}
          animate={{ y: 0, rotateX: 0, opacity: 1 }}
          exit={{ y: '-90%', rotateX: 70, opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.35, ease: [0.2, 0, 0, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function FlipDivider() {
  return (
    <span
      className="flex flex-col items-center justify-center gap-1.5 mx-0"
      style={{ height: FLIP_CARD_HEIGHT }}
      aria-hidden
    >
      <span className="w-[5px] h-[5px] rounded-full bg-text-muted" />
      <span className="w-[5px] h-[5px] rounded-full bg-text-muted" />
    </span>
  );
}

function loadSetups(): SavedSetup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_SETUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSetup[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface SessionTimerProps {
  onSessionComplete: (session: Session) => void;
  taskTypes: string[];
  onAddTaskType: (type: string) => void;
  onRemoveTaskType: (type: string) => void;
  onNavigateToHistory?: () => void;
  initialTask?: string;
  initialSeconds?: number;
}

export const SessionTimer = memo(function SessionTimer({
  onSessionComplete,
  taskTypes,
  onAddTaskType,
  onRemoveTaskType,
  onNavigateToHistory,
  initialTask,
  initialSeconds,
}: SessionTimerProps) {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<'setup' | 'active' | 'complete'>('setup');
  const [selectedTask, setSelectedTask] = useState(initialTask || DEFAULT_TASK);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddTypeInput, setShowAddTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customUnit, setCustomUnit] = useState<'minutes' | 'hours'>('minutes');
  const [customValue, setCustomValue] = useState(25);
  const [customActive, setCustomActive] = useState<number | null>(null);
  const [showSavedSetups, setShowSavedSetups] = useState(false);
  const [savedSetups, setSavedSetups] = useState<SavedSetup[]>(loadSetups);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [lastCompleted, setLastCompleted] = useState<{ task: string; seconds: number } | null>(null);
  const startTimestampRef = useRef<Date | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allTaskTypes = useMemo(() => [...QUICK_TASKS, ...taskTypes], [taskTypes]);

  const query = searchQuery.trim().toLowerCase();
  const filteredTasks = useMemo(
    () => allTaskTypes.filter((t) => t.toLowerCase().includes(query)),
    [allTaskTypes, query],
  );
  const canCreate = query.length > 0 && !allTaskTypes.some((t) => t.toLowerCase() === query);

  const taskName = useMemo(() => selectedTask || 'Focus Session', [selectedTask]);

  function showFeedback(text: string, tone: Feedback['tone'] = 'neutral') {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback({ text, tone });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2600);
  }

  function handleAutoComplete() {
    const endTime = new Date();
    const startTime = startTimestampRef.current || new Date();
    const elapsedMs = endTime.getTime() - startTime.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const actualHours = Math.floor(elapsedSeconds / 3600);
    const actualMinutes = Math.floor((elapsedSeconds % 3600) / 60);

    const session: Session = {
      id: new Date().getTime(),
      task: taskName,
      duration: formatSecondsAsDuration(elapsedSeconds),
      date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      status: 'Completed',
      startTime: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      endTime: endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      actualDuration: actualHours > 0 ? `${actualHours}h ${actualMinutes}m` : `${actualMinutes}m`,
    };

    onSessionComplete(session);
    setLastCompleted({ task: taskName, seconds: timer.totalSeconds });
    setMode('complete');
    setConfirmEnd(false);
    startTimestampRef.current = null;
  }

  const timer = useTimer({
    initialSeconds: initialSeconds || partsToSeconds(0, 25, 0),
    onComplete: handleAutoComplete,
  });

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_SETUPS_KEY, JSON.stringify(savedSetups));
    } catch {
      /* storage unavailable */
    }
  }, [savedSetups]);

  function handleStartSession() {
    if (!taskName.trim()) {
      showFeedback('Choose a task to focus on.', 'warning');
      return;
    }
    if (timer.totalSeconds <= 0) {
      showFeedback('Choose a duration first.', 'warning');
      return;
    }
    setIsStarting(true);
    setTimeout(
      () => {
        setIsStarting(false);
        setMode('active');
        startTimestampRef.current = new Date();
        timer.start();
        showFeedback('Session started.', 'success');
      },
      reduced ? 0 : 400,
    );
  }

  function handleAddTime(seconds: number) {
    timer.addTime(seconds);
    if (!timer.isRunning) {
      timer.start();
    }
    showFeedback(`Added ${seconds / 60} minutes.`);
  }

  function handleEndSession() {
    const elapsed = timer.totalSeconds - timer.remainingSeconds;
    if (!confirmEnd && elapsed >= 60) {
      setConfirmEnd(true);
      return;
    }
    setConfirmEnd(false);
    resetSession();
    showFeedback('Session ended.');
  }

  function resetSession() {
    setMode('setup');
    setConfirmEnd(false);
    timer.reset();
    setSearchQuery('');
    setShowAddTypeInput(false);
    setShowCustomTime(false);
    setShowSavedSetups(false);
    setSavingSetup(false);
    startTimestampRef.current = null;
  }

  function startAnother() {
    setMode('setup');
    setConfirmEnd(false);
    timer.reset();
    startTimestampRef.current = null;
    showFeedback('Ready for another session.');
  }

  function applyPreset(hours: number, minutes: number, seconds: number) {
    timer.setDurationFromParts(hours, minutes, seconds);
    setCustomActive(null);
    setShowCustomTime(false);
  }

  function openCustomEditor() {
    const total = timer.totalSeconds;
    if (total > 0 && total % 3600 === 0 && total >= 3600) {
      setCustomUnit('hours');
      setCustomValue(total / 3600);
    } else {
      setCustomUnit('minutes');
      setCustomValue(Math.max(1, Math.round(total / 60)));
    }
    setShowCustomTime(true);
  }

  function adjustCustomValue(delta: number) {
    setCustomValue((v) => Math.max(1, Math.min(customUnit === 'minutes' ? 480 : 24, v + delta)));
  }

  function applyCustomDuration() {
    const total = (customUnit === 'minutes' ? customValue : customValue * 60) * 60;
    if (total <= 0) {
      showFeedback('Choose a duration longer than 0 minutes.', 'warning');
      return;
    }
    timer.setDuration(total);
    setCustomActive(total);
    setShowCustomTime(false);
    showFeedback(`Duration updated to ${describeDuration(total)}.`);
  }

  function selectTask(task: string) {
    setSelectedTask(task);
    setSearchQuery('');
    setShowAddTypeInput(false);
  }

  function createTaskFromSearch() {
    if (!canCreate) return;
    onAddTaskType(searchQuery.trim());
    setSelectedTask(searchQuery.trim());
    setSearchQuery('');
    showFeedback(`Created "${searchQuery.trim()}".`);
  }

  function addTaskType() {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    onAddTaskType(trimmed);
    setSelectedTask(trimmed);
    setNewTypeName('');
    setShowAddTypeInput(false);
    showFeedback(`Task "${trimmed}" added.`);
  }

  function commitSetup(name: string) {
    const trimmed = name.trim();
    if (!trimmed || timer.totalSeconds <= 0) return;
    const exists = savedSetups.some((s) => s.task === trimmed && s.seconds === timer.totalSeconds);
    if (exists) {
      setSavingSetup(false);
      showFeedback('This setup is already saved.');
      return;
    }
    setSavedSetups((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, task: trimmed, seconds: timer.totalSeconds },
    ]);
    setSavingSetup(false);
    setSetupName('');
    showFeedback('Setup saved.');
  }

  function applySetup(setup: SavedSetup) {
    setSelectedTask(setup.task);
    timer.setDuration(setup.seconds);
    setCustomActive(null);
    setShowCustomTime(false);
    setShowSavedSetups(false);
    showFeedback(`Applied "${setup.task}" · ${describeDuration(setup.seconds)}.`);
  }

  const currentSetupSaved = savedSetups.some((s) => s.task === taskName && s.seconds === timer.totalSeconds);

  const ringRadius = 58;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card-glass rounded-[24px] overflow-hidden"
    >
      <AnimatePresence mode="wait">
        {mode === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="px-5 sm:px-8 py-6 sm:py-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ===== Preview ===== */}
              <div className="flex flex-col items-center justify-center bg-surface rounded-2xl border border-border px-5 py-7 text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                  Ready to Focus
                </div>
                <div className="mt-3 text-[36px] sm:text-[44px] font-bold leading-none tracking-tight text-text font-mono tabular-nums">
                  {formatClock(timer.totalSeconds)}
                </div>
                <div className="mt-2.5 text-[13px] text-text-muted truncate max-w-[220px]">{taskName}</div>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" aria-hidden />
                  <span className="text-[12px] text-text-secondary">Ready to start</span>
                </div>
              </div>

              {/* ===== Controls ===== */}
              <div className="space-y-5">
                {/* ===== Focus ===== */}
                <section aria-labelledby="focus-heading">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <label
                      id="focus-heading"
                      htmlFor="focus-search"
                      className="text-xs font-semibold text-text-secondary"
                    >
                      Select Task
                    </label>
                    <button
                      onClick={() => setShowAddTypeInput((v) => !v)}
                      aria-expanded={showAddTypeInput}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:text-accent-hover transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg px-1 py-0.5 shrink-0"
                    >
                      <FiPlus size={13} aria-hidden /> Add task
                    </button>
                  </div>

                  <div className="relative">
                    <FiSearch
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                      aria-hidden
                    />
                    <input
                      id="focus-search"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        if (canCreate) {
                          createTaskFromSearch();
                        } else if (filteredTasks.length > 0) {
                          selectTask(filteredTasks[0]);
                        }
                      }}
                      placeholder="Search or create a focus"
                      aria-label="Search or create a focus"
                      className="w-full h-10 pl-9 pr-3 bg-surface-hover border border-border rounded-[12px] text-[14px] text-text placeholder:text-text-muted outline-none transition-all duration-200 focus:bg-surface-raised focus:border-border-hover focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </div>

                  <AnimatePresence>
                    {showAddTypeInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: reduced ? 0 : 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2.5 bg-surface-hover/60 border border-border rounded-[12px] p-3">
                          <label className="text-[10px] uppercase tracking-[0.08em] text-text-muted block mb-1.5">
                            Task name
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newTypeName}
                              onChange={(e) => setNewTypeName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTypeName.trim()) addTaskType();
                              }}
                              placeholder="e.g. Meditation"
                              aria-label="New task name"
                              className="flex-1 h-9 px-3 bg-surface border border-border rounded-[10px] text-[13px] text-text placeholder:text-text-muted outline-none transition-all focus:border-border-hover focus:ring-2 focus:ring-[var(--focus-ring)]"
                              autoFocus
                            />
                            <button
                              onClick={addTaskType}
                              disabled={!newTypeName.trim()}
                              className="h-9 px-3 rounded-[10px] bg-accent text-accent-contrast text-[12px] font-semibold hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => {
                                setNewTypeName('');
                                setShowAddTypeInput(false);
                              }}
                              className="h-9 px-3 rounded-[10px] bg-surface border border-border text-text-secondary hover:text-text text-[12px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Focus tasks">
                    {filteredTasks.map((task) => {
                      const isCustom = taskTypes.includes(task);
                      const isSelected = selectedTask === task;
                      const Icon = TASK_ICONS[task];
                      return (
                        <div key={task} className="relative group">
                          <button
                            onClick={() => selectTask(task)}
                            aria-pressed={isSelected}
                            className={`relative inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[13px] font-medium transition-all duration-[200ms] ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-px active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none ${
                              isSelected
                                ? 'bg-text text-page border border-accent/30'
                                : 'border border-border bg-surface-hover/40 text-text-secondary hover:bg-surface-hover/80 hover:text-text hover:border-border-hover'
                            }`}
                          >
                            {Icon ? (
                              <Icon size={13} aria-hidden className={isSelected ? 'text-page' : 'text-text-muted'} />
                            ) : null}
                            <span className="truncate max-w-[120px]">{task}</span>
                            {isSelected && <FiCheck size={13} aria-hidden className="text-page shrink-0" />}
                          </button>
                          {isCustom && (
                            <button
                              onClick={() => onRemoveTaskType(task)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger text-white rounded-full flex items-center justify-center opacity-60 hover:opacity-100 focus-visible:opacity-100 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                              aria-label={`Remove ${task}`}
                              title={`Remove ${task}`}
                            >
                              <FiX size={9} aria-hidden />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {canCreate && (
                      <button
                        onClick={createTaskFromSearch}
                        className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[10px] border border-dashed border-border bg-surface-hover/40 text-accent hover:bg-surface-hover/80 text-[13px] font-medium transition-all duration-150 hover:-translate-y-px active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      >
                        <FiPlus size={13} aria-hidden /> Create &ldquo;{searchQuery.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                </section>

                {/* ===== Duration ===== */}
                <section aria-labelledby="duration-heading" className="mt-5">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <label id="duration-heading" className="text-xs font-semibold text-text-secondary">
                      Duration
                    </label>
                    <button
                      onClick={() => (showCustomTime ? setShowCustomTime(false) : openCustomEditor())}
                      aria-expanded={showCustomTime}
                      className={`inline-flex items-center gap-1 text-[12px] font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg px-1 py-0.5 shrink-0 ${
                        customActive !== null ? 'text-accent' : 'text-text-secondary hover:text-text'
                      }`}
                    >
                      <FiEdit3
                        size={12}
                        aria-hidden
                        className={customActive !== null ? 'text-accent' : 'text-text-muted'}
                      />
                      {customActive !== null ? `Custom · ${shortDurationLabel(customActive)}` : 'Custom'}
                    </button>
                  </div>

                  {!showCustomTime ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Focus durations">
                        {PRESET_DURATIONS.map((preset) => {
                          const isActive =
                            Math.floor(timer.totalSeconds / 3600) === preset.hours &&
                            Math.floor((timer.totalSeconds % 3600) / 60) === preset.minutes &&
                            timer.totalSeconds % 60 === preset.seconds;
                          return (
                            <button
                              key={preset.label}
                              onClick={() => applyPreset(preset.hours, preset.minutes, preset.seconds)}
                              aria-pressed={isActive}
                              className={`relative inline-flex items-center justify-center h-10 min-w-0 rounded-[12px] text-[13px] font-medium tabular-nums transition-all duration-[200ms] ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-px active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none ${
                                isActive
                                  ? 'bg-text text-page shadow-[0_1px_3px_rgba(0,0,0,0.2)]'
                                  : 'border border-border bg-surface-hover/40 text-text-secondary hover:bg-surface-hover/80 hover:text-text hover:border-border-hover'
                              }`}
                            >
                              {preset.label}
                              {isActive && (
                                <span
                                  aria-hidden
                                  className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-[13px] text-text-secondary" aria-live="polite">
                        {summaryLabel(timer.totalSeconds)} {taskName} session
                      </p>
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: reduced ? 0 : 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2.5 bg-surface-hover/60 border border-border rounded-[12px] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[12px] font-medium text-text">Duration</span>
                          <div className="flex items-center bg-surface rounded-lg p-0.5 border border-border">
                            {(['minutes', 'hours'] as const).map((unit) => (
                              <button
                                key={unit}
                                onClick={() => setCustomUnit(unit)}
                                aria-pressed={customUnit === unit}
                                className={`h-7 px-2.5 rounded-md text-[11px] font-medium capitalize transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                                  customUnit === unit
                                    ? 'bg-surface-raised text-text shadow-sm'
                                    : 'text-text-secondary hover:text-text'
                                }`}
                              >
                                {unit}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-center gap-2.5">
                          <button
                            onClick={() => adjustCustomValue(-1)}
                            className="w-10 h-10 flex items-center justify-center rounded-[10px] bg-surface border border-border text-text-secondary hover:text-text hover:border-border-hover transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            aria-label={`Decrease ${customUnit}`}
                          >
                            <FiMinus size={13} aria-hidden />
                          </button>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max={customUnit === 'minutes' ? 480 : 24}
                              value={customValue}
                              onChange={(e) => setCustomValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              aria-label={`Custom duration in ${customUnit}`}
                              className="w-20 px-0 py-2 bg-transparent text-text text-center text-[20px] font-semibold tabular-nums outline-none focus:text-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-[12px] text-text-muted capitalize">
                              {customUnit === 'minutes' ? 'minutes' : 'hours'}
                            </span>
                          </div>
                          <button
                            onClick={() => adjustCustomValue(1)}
                            className="w-10 h-10 flex items-center justify-center rounded-[10px] bg-surface border border-border text-text-secondary hover:text-text hover:border-border-hover transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            aria-label={`Increase ${customUnit}`}
                          >
                            <FiPlus size={13} aria-hidden />
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                          {[10, 20, 50, 90].map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setCustomUnit('minutes');
                                setCustomValue(m);
                              }}
                              className="h-9 px-2.5 rounded-lg bg-surface border border-border text-text-secondary hover:text-text text-[12px] font-medium tabular-nums transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            >
                              {m}m
                            </button>
                          ))}
                        </div>

                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            onClick={() => setShowCustomTime(false)}
                            className="h-10 px-3 rounded-[10px] text-[12px] font-medium bg-surface border border-border text-text-secondary hover:text-text transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={applyCustomDuration}
                            className="h-10 px-3 rounded-[10px] text-[12px] font-semibold bg-accent hover:bg-accent-hover text-accent-contrast transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                          >
                            Apply duration
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </section>

                {/* ===== Saved setups ===== */}
                <section aria-labelledby="setups-heading" className="mt-5">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowSavedSetups((v) => !v)}
                      aria-expanded={showSavedSetups}
                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary hover:text-text transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg px-1 py-0.5"
                    >
                      <FiBookmark
                        size={13}
                        aria-hidden
                        className={showSavedSetups ? 'text-accent' : 'text-text-muted'}
                      />
                      Saved setups
                      {savedSetups.length > 0 && (
                        <span className="text-[10px] font-semibold tabular-nums text-text-muted bg-surface-hover rounded-full px-1.5 py-0.5">
                          {savedSetups.length}
                        </span>
                      )}
                    </button>
                    {showSavedSetups && !savingSetup && !currentSetupSaved && (
                      <button
                        onClick={() => {
                          setSetupName(taskName);
                          setSavingSetup(true);
                        }}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:text-accent-hover transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg px-1 py-0.5"
                      >
                        <FiPlus size={13} aria-hidden /> Save current setup
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {showSavedSetups && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: reduced ? 0 : 0.22, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        {savingSetup ? (
                          <div className="mt-2.5 bg-surface-hover/60 border border-border rounded-[12px] p-3">
                            <label className="text-[10px] uppercase tracking-[0.08em] text-text-muted block mb-1.5">
                              Name this setup
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={setupName}
                                onChange={(e) => setSetupName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && setupName.trim()) commitSetup(setupName);
                                }}
                                placeholder="e.g. Morning deep work"
                                aria-label="Setup name"
                                className="flex-1 h-9 px-3 bg-surface border border-border rounded-[10px] text-[13px] text-text placeholder:text-text-muted outline-none transition-all focus:border-border-hover focus:ring-2 focus:ring-[var(--focus-ring)]"
                                autoFocus
                              />
                              <button
                                onClick={() => commitSetup(setupName)}
                                disabled={!setupName.trim()}
                                className="h-9 px-3 rounded-[10px] bg-accent text-accent-contrast text-[12px] font-semibold hover:bg-accent-hover transition-colors duration-150 disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setSavingSetup(false)}
                                className="h-9 px-3 rounded-[10px] bg-surface border border-border text-text-secondary hover:text-text text-[12px] font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : savedSetups.length === 0 ? (
                          <div className="mt-2.5 bg-surface-hover/40 border border-border rounded-[12px] px-4 py-4 text-center">
                            <FiBookmark className="mx-auto text-text-muted" size={15} aria-hidden />
                            <p className="mt-1.5 text-[13px] text-text-secondary">No saved setups yet.</p>
                            <p className="mt-0.5 text-[11px] text-text-muted">
                              Configure a session and save it for later.
                            </p>
                          </div>
                        ) : (
                          <ul className="mt-2.5 bg-surface-hover/40 border border-border rounded-[12px] divide-y divide-divider overflow-hidden">
                            {savedSetups.map((setup) => (
                              <li key={setup.id}>
                                <div className="flex items-center gap-2 px-3 py-2">
                                  <button
                                    onClick={() => applySetup(setup)}
                                    className="flex-1 min-w-0 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                  >
                                    <span className="block text-[13px] font-medium text-text truncate">
                                      {setup.task} · {shortDurationLabel(setup.seconds)}
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => setSavedSetups((prev) => prev.filter((s) => s.id !== setup.id))}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 hover:opacity-100 focus-visible:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                    aria-label={`Delete ${setup.task} setup`}
                                    title="Delete setup"
                                  >
                                    <FiTrash2 size={13} aria-hidden />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* ===== Start ===== */}
                <div className="mt-5">
                  <motion.button
                    onClick={handleStartSession}
                    disabled={isStarting}
                    aria-label={startLabel(timer.totalSeconds)}
                    className="w-full h-12 rounded-[14px] bg-accent hover:bg-accent-hover text-accent-contrast font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-[200ms] ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-px active:translate-y-0 active:scale-[0.985] active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_2px_8px_rgba(0,0,0,0.12)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] motion-reduce:transition-none motion-reduce:transform-none"
                  >
                    {isStarting ? (
                      <>
                        <span
                          className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                          aria-hidden
                        />
                        Starting session…
                      </>
                    ) : (
                      <>
                        <FiPlay size={17} fill="currentColor" aria-hidden /> {startLabel(timer.totalSeconds)}
                      </>
                    )}
                  </motion.button>

                  <p className="mt-2 text-center text-[12px] text-text-muted" aria-live="polite">
                    Ready to focus
                  </p>

                  <AnimatePresence>
                    {feedback && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduced ? 0 : 0.18 }}
                        className={`mt-2 flex items-center justify-center gap-1.5 text-[12px] font-medium ${
                          feedback.tone === 'warning' ? 'text-warning' : 'text-success'
                        }`}
                        role="status"
                      >
                        <FiCheckCircle size={13} aria-hidden />
                        {feedback.text}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'active' && (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.3 }}
            className="px-6 sm:px-10 py-10 lg:py-14"
          >
            <div className="flex flex-col items-center max-w-md mx-auto">
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-text-secondary">{taskName}</span>
              </div>

              <div className="relative mt-6" role="timer" aria-live="off" aria-label="Remaining time">
                <svg
                  viewBox="0 0 120 120"
                  className="w-[min(280px,calc(100vw-80px))] h-[min(280px,calc(100vw-80px))] sm:w-[316px] sm:h-[316px] -rotate-90"
                  aria-hidden="true"
                >
                  <circle cx="60" cy="60" r={ringRadius} fill="none" stroke="var(--border)" strokeWidth="3.5" />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    animate={{
                      strokeDashoffset: ringCircumference * (1 - timer.progress / 100),
                    }}
                    transition={{ duration: reduced ? 0 : 0.45, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="sr-only">{formatClock(timer.remainingSeconds)}</span>
                  <div className="flex items-center gap-1" aria-hidden>
                    {(() => {
                      const digits = formatClock(timer.remainingSeconds).replace(/:/g, '');
                      return (
                        <>
                          <FlipDigit value={digits[0]} />
                          <FlipDigit value={digits[1]} />
                          <FlipDivider />
                          <FlipDigit value={digits[2]} />
                          <FlipDigit value={digits[3]} />
                          <FlipDivider />
                          <FlipDigit value={digits[4]} />
                          <FlipDigit value={digits[5]} />
                        </>
                      );
                    })()}
                  </div>
                  <span className="mt-3 text-xs text-text-muted tabular-nums">
                    {Math.round(timer.progress)}% complete
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 text-sm text-text-muted" aria-live="polite">
                <span className={`w-2 h-2 rounded-full ${timer.isRunning ? 'bg-accent/80' : 'bg-warning/80'}`} />
                {timer.isRunning ? 'Focus session in progress' : 'Session paused'}
              </div>

              <div className="mt-7 flex items-center gap-3 w-full justify-center flex-wrap">
                {!timer.isRunning ? (
                  <button
                    onClick={timer.start}
                    disabled={timer.remainingSeconds === 0}
                    className="h-12 px-6 rounded-[14px] bg-accent hover:bg-accent-hover text-accent-contrast font-semibold text-[15px] flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                  >
                    <FiPlay size={17} fill="currentColor" aria-hidden /> Resume
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      timer.pause();
                      showFeedback('Session paused.');
                    }}
                    className="h-12 px-6 rounded-[14px] bg-accent hover:bg-accent-hover text-accent-contrast font-semibold text-[15px] flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                  >
                    <FiPause size={17} aria-hidden /> Pause
                  </button>
                )}
                <button
                  onClick={handleEndSession}
                  className="h-12 px-6 rounded-[14px] bg-danger/10 text-danger border border-danger/20 font-semibold text-[15px] hover:bg-danger/20 transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                >
                  End session
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
                {ADD_TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => handleAddTime(opt.seconds)}
                    className="h-10 px-3 rounded-lg bg-surface-hover border border-border text-text-secondary hover:text-text transition-colors text-[13px] font-medium focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={timer.reset}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-hover border border-border text-text-secondary hover:text-text transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                  title="Reset time"
                  aria-label="Reset time"
                >
                  <FiRotateCcw size={15} />
                </button>
              </div>

              <AnimatePresence>
                {confirmEnd && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                    className="mt-6 w-full bg-surface-hover border border-border rounded-xl px-4 py-3 text-center"
                    role="alertdialog"
                    aria-label="Confirm ending session"
                  >
                    <p className="text-sm text-text-secondary">End this session now? Your progress will be lost.</p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setConfirmEnd(false)}
                        className="h-10 px-4 rounded-xl text-sm font-medium bg-surface border border-border text-text-secondary hover:text-text transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                      >
                        Keep going
                      </button>
                      <button
                        onClick={handleEndSession}
                        className="h-10 px-4 rounded-xl text-sm font-semibold bg-danger text-white hover:bg-danger/90 transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                      >
                        End session
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.18 }}
                    className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary"
                    role="status"
                  >
                    <FiCheckCircle size={14} className="text-success" aria-hidden />
                    {feedback.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {mode === 'complete' && lastCompleted && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.3 }}
            className="px-6 sm:px-10 py-12 flex flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: reduced ? 1 : 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.35, ease: 'easeOut' }}
              className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center"
            >
              <FiCheckCircle size={28} className="text-success" aria-hidden />
            </motion.div>
            <h2 className="mt-5 text-xl font-semibold tracking-[-0.01em] text-text">Session complete</h2>
            <p className="mt-1.5 text-sm text-text-muted">
              {describeDuration(lastCompleted.seconds)} of {lastCompleted.task} finished.
            </p>
            <div className="mt-7 flex items-center gap-3 flex-wrap justify-center">
              <button
                onClick={startAnother}
                className="h-12 px-6 rounded-[14px] bg-accent hover:bg-accent-hover text-accent-contrast font-semibold text-[15px] flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
              >
                <FiPlay size={17} fill="currentColor" aria-hidden /> Start another session
              </button>
              <button
                onClick={() => onNavigateToHistory?.()}
                className="h-12 px-6 rounded-[14px] bg-surface-hover border border-border text-text-secondary hover:text-text font-semibold text-[15px] flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
              >
                <FiList size={16} aria-hidden /> View session history
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
