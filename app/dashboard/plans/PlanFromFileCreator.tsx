'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  FiUpload,
  FiFileText,
  FiFile,
  FiCheckCircle,
  FiCheck,
  FiCalendar,
  FiTarget,
  FiList,
  FiZap,
  FiAlertCircle,
  FiMinus,
  FiPlus,
  FiEdit3,
  FiEye,
  FiLoader,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiArrowDown,
  FiArrowUp,
  FiUser,
  FiBriefcase,
  FiFolder,
  FiBookOpen,
  FiSliders,
  FiRefreshCw,
  FiInfo,
  FiPaperclip,
  FiTrash2,
} from 'react-icons/fi';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { toIsoDateString } from '@/src/utils/date';
import type { IconType } from 'react-icons';
import type { Plan, PlanPriority } from '@/src/types';
import { createPlanFromFile } from '@/lib/plans/planFileApi';
import { FILE_TYPE_LABELS, MAX_FILE_SIZE } from '@/lib/plans/files';
import { buildStudyPlanText, formatFileSize, type StudySession } from './studySchedule';
import InlinePlanCreator from './InlinePlanCreator';
import AssistantSuggestions from './AssistantSuggestions';
import { usePlanningSignals } from '@/lib/assistant/usePlanningSignals';
import type { DraftPatch, PlanDraft } from '@/lib/assistant/types';

interface PlanFromFileCreatorProps {
  onAddPlan: (plan: Omit<Plan, 'id' | 'status'>) => void;
  onAddPlanFromFile: (plan: Plan) => void;
  openRequest?: number;
  templateRequest?: { title: string; key: number } | null;
}

type CategoryPreset = 'Study' | 'Work' | 'Personal' | 'Project' | 'Custom';
type DueQuick = 'today' | 'tomorrow' | 'weekend' | 'custom';
type ScheduleMode = 'recommended' | 'accepted' | 'adjusted';
type FilePhase = 'processing' | 'ready';

const inputCls =
  'w-full px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DURATION_CHIPS = [25, 45, 60, 90];
const MIN_SESSIONS = 1;
const MAX_SESSIONS = 12;

function chipSelectedCls(selected: boolean) {
  return selected
    ? 'border-accent bg-accent-muted text-text shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
    : 'border-border-hover text-text-secondary hover:border-border hover:text-text';
}

const CATEGORIES: { id: CategoryPreset; icon: IconType }[] = [
  { id: 'Study', icon: FiBookOpen },
  { id: 'Work', icon: FiBriefcase },
  { id: 'Personal', icon: FiUser },
  { id: 'Project', icon: FiFolder },
  { id: 'Custom', icon: FiSliders },
];

const DUE_OPTIONS: { id: DueQuick; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'custom', label: 'Pick a date' },
];

const PRIORITY_OPTIONS: { id: PlanPriority; icon: IconType; label: string; desc: string; iconCls: string }[] = [
  {
    id: 'low',
    icon: FiArrowDown,
    label: 'Low',
    desc: 'Flexible — pick it up whenever it fits.',
    iconCls: 'text-info/80',
  },
  {
    id: 'medium',
    icon: FiMinus,
    label: 'Medium',
    desc: 'Steady progress, without the pressure.',
    iconCls: 'text-accent',
  },
  {
    id: 'high',
    icon: FiArrowUp,
    label: 'High',
    desc: 'Wants attention before your other plans.',
    iconCls: 'text-warning/80',
  },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function weekendDate(base: Date): Date {
  const d = new Date(base);
  const diff = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function distributeSessions(count: number, slots: number): number[] {
  const out: number[] = [];
  let remaining = count;
  let open = slots;
  for (let i = 0; i < slots; i += 1) {
    const c = Math.ceil(remaining / open);
    out.push(c);
    remaining -= c;
    open -= 1;
  }
  return out;
}

interface Suggestion {
  title: string;
  category: CategoryPreset;
  sessions: number;
  minutes: number;
  priority: PlanPriority;
}

function deriveSuggestion(file: File): Suggestion {
  const base = file.name.replace(/\.[^.]*$/, '').trim() || 'My study plan';
  const lower = base.toLowerCase();
  let category: CategoryPreset = 'Study';
  if (/(work|report|proposal|client|meeting|business|review|standup|email|task)/.test(lower)) category = 'Work';
  else if (/(personal|health|budget|finance|family|home|habit)/.test(lower)) category = 'Personal';
  else if (/(project|roadmap|launch|app|design|build|feature|sprint)/.test(lower)) category = 'Project';
  else category = 'Study';
  return { title: base, category, sessions: 3, minutes: 45, priority: 'medium' };
}

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function PlanFromFileCreator({
  onAddPlan,
  onAddPlanFromFile,
  openRequest = 0,
  templateRequest,
}: PlanFromFileCreatorProps) {
  const reduced = useReducedMotion();
  const { signals } = usePlanningSignals();
  const [mode, setMode] = useState<'manual' | 'file'>('file');
  const [manualPreset, setManualPreset] = useState<{ title: string; key: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePhase, setFilePhase] = useState<FilePhase>('ready');
  const [fileError, setFileError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [suggestionShown, setSuggestionShown] = useState(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  const [title, setTitle] = useState('');
  const [titleEditing, setTitleEditing] = useState(false);
  const [category, setCategory] = useState<CategoryPreset>('Study');
  const [customCategory, setCustomCategory] = useState('');
  const [dueQuick, setDueQuick] = useState<DueQuick>('tomorrow');
  const [customDate, setCustomDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState<Date>(() => new Date());
  const [priority, setPriority] = useState<PlanPriority>('medium');

  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('recommended');
  const [sessionCount, setSessionCount] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [scheduleWeekdays, setScheduleWeekdays] = useState<number[]>([]);
  const [scheduleTime, setScheduleTime] = useState('');

  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdTitle, setCreatedTitle] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const processTimer = useRef<number | null>(null);
  const progressTimer = useRef<number | null>(null);

  const today = new Date();
  const todayIso = toIsoDateString(today);
  const resolvedDate =
    dueQuick === 'today'
      ? todayIso
      : dueQuick === 'tomorrow'
        ? toIsoDateString(addDays(today, 1))
        : dueQuick === 'weekend'
          ? toIsoDateString(weekendDate(today))
          : customDate || todayIso;

  const categoryValue = category === 'Custom' ? customCategory.trim() || 'Study' : category;
  const titleValid = title.trim().length >= 3;
  const titleTooLong = title.length > 100;
  const fileReady = !!file && filePhase === 'ready';
  const canSubmit = fileReady && titleValid && !titleTooLong && !isSubmitting;

  const fileTypeLabel = file ? (FILE_TYPE_LABELS[file.type] ?? file.type.split('/')[1]?.toUpperCase() ?? 'File') : '';

  const sessions: StudySession[] = Array.from({ length: sessionCount }, (_, i) => ({
    index: i + 1,
    title: `Session ${i + 1}`,
    pageRange: 'full',
    minutes: sessionMinutes,
    done: false,
  }));
  const totalMinutes = sessionCount * sessionMinutes;

  const draft: PlanDraft = useMemo(
    () => ({
      title: title.trim() || undefined,
      category: categoryValue,
      priority,
      type: 'weekly',
      date: resolvedDate,
    }),
    [title, categoryValue, priority, resolvedDate],
  );

  function applyPatch(patch: DraftPatch) {
    if (patch.date) {
      const tomorrowIso = toIsoDateString(addDays(today, 1));
      if (patch.date === todayIso) {
        setDueQuick('today');
        setCustomDate('');
        setCalendarOpen(false);
      } else if (patch.date === tomorrowIso) {
        setDueQuick('tomorrow');
        setCustomDate('');
        setCalendarOpen(false);
      } else {
        setDueQuick('custom');
        setCustomDate(patch.date);
        setCalendarOpen(false);
      }
    }
    if (patch.priority) setPriority(patch.priority);
    if (patch.descriptionAppend) {
      setNotesOpen(true);
      setNotes((prev) =>
        prev.includes(patch.descriptionAppend!)
          ? prev
          : prev
            ? `${prev}\n${patch.descriptionAppend}`
            : patch.descriptionAppend!,
      );
    }
  }

  const timeline = distributeSessions(sessionCount, 6).map((count, i) => ({
    day: i + 1,
    count,
    date: addDays(today, i + 1),
  }));

  useEffect(() => {
    if (templateRequest && templateRequest.key > 0) {
      const t = window.setTimeout(() => {
        setMode('manual');
        setManualPreset(templateRequest);
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [templateRequest]);

  useEffect(() => {
    return () => {
      if (processTimer.current) window.clearTimeout(processTimer.current);
      if (progressTimer.current) window.clearInterval(progressTimer.current);
    };
  }, []);

  useEffect(() => {
    if (filePhase === 'ready' && file && !suggestionApplied) {
      const t = window.setTimeout(() => setSuggestionShown(true), reduced ? 0 : 120);
      return () => window.clearTimeout(t);
    }
  }, [filePhase, file, suggestionApplied, reduced]);

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => resetForm(), 2200);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

  function applySuggestion(f: File) {
    const s = deriveSuggestion(f);
    setTitle(s.title);
    setCategory(s.category);
    setDueQuick('tomorrow');
    setCustomDate('');
    setPriority(s.priority);
    setSessionCount(s.sessions);
    setSessionMinutes(s.minutes);
    setScheduleMode('recommended');
  }

  function pickFile(f: File | undefined | null) {
    setFileError('');
    if (!f) return;
    const allowed = Object.keys(FILE_TYPE_LABELS);
    if (!allowed.includes(f.type)) {
      setFileError('Unsupported file. Upload a PDF, Word document, or text file.');
      return;
    }
    if (!(f.size > 0 && f.size <= MAX_FILE_SIZE)) {
      setFileError(`File must be under ${MAX_FILE_SIZE / (1024 * 1024)} MB.`);
      return;
    }
    setFile(f);
    setFilePhase('processing');
    setProcessingProgress(0);
    setSuggestionShown(false);
    setSuggestionApplied(false);
    setDetailsOpen(false);
    setCalendarOpen(false);
    setNotesOpen(false);
    setTitleEditing(false);
    applySuggestion(f);
    if (processTimer.current) window.clearTimeout(processTimer.current);
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    progressTimer.current = window.setInterval(() => {
      setProcessingProgress((p) => Math.min(92, p + 3 + Math.random() * 9));
    }, 90);
    processTimer.current = window.setTimeout(
      () => {
        setFilePhase('ready');
        setProcessingProgress(100);
        if (progressTimer.current) window.clearInterval(progressTimer.current);
        progressTimer.current = null;
      },
      reduced ? 0 : 900,
    );
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  function removeFile() {
    if (processTimer.current) window.clearTimeout(processTimer.current);
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    progressTimer.current = null;
    setProcessingProgress(0);
    setFile(null);
    setFilePhase('ready');
    setFileError('');
    setDetailsOpen(false);
    setSuggestionShown(false);
    setSuggestionApplied(false);
    setTitle('');
    setTitleEditing(false);
    setCategory('Study');
    setCustomCategory('');
    setDueQuick('tomorrow');
    setCustomDate('');
    setCalendarOpen(false);
    setPriority('medium');
    setScheduleMode('recommended');
    setSessionCount(3);
    setSessionMinutes(45);
    setScheduleWeekdays([]);
    setScheduleTime('');
    setNotesOpen(false);
    setNotes('');
  }

  function resetForm() {
    if (processTimer.current) window.clearTimeout(processTimer.current);
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    progressTimer.current = null;
    setProcessingProgress(0);
    setFile(null);
    setFilePhase('ready');
    setFileError('');
    setDetailsOpen(false);
    setSuggestionShown(false);
    setSuggestionApplied(false);
    setTitle('');
    setTitleEditing(false);
    setCategory('Study');
    setCustomCategory('');
    setDueQuick('tomorrow');
    setCustomDate('');
    setCalendarOpen(false);
    setPriority('medium');
    setScheduleMode('recommended');
    setSessionCount(3);
    setSessionMinutes(45);
    setScheduleWeekdays([]);
    setScheduleTime('');
    setNotesOpen(false);
    setNotes('');
    setIsSubmitting(false);
    setIsSuccess(false);
    setCreatedTitle('');
  }

  function previewFile() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const win = window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (!win) console.warn('Could not open the document in a new tab.');
  }

  function toggleWeekday(d: number) {
    setScheduleWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  }

  function openCalendar() {
    const base = customDate ? new Date(`${customDate}T00:00:00`) : new Date(`${resolvedDate}T00:00:00`);
    setCalendarCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    setCalendarOpen(true);
  }

  function useSuggestion() {
    setSuggestionApplied(true);
    setSuggestionShown(false);
  }

  function customizeSuggestion() {
    setSuggestionShown(false);
  }

  function handleSubmit() {
    if (!canSubmit || !file) return;
    setIsSubmitting(true);
    const planId = Date.now();
    const parts: string[] = [];
    if (notes.trim()) parts.push(notes.trim());
    if (scheduleWeekdays.length > 0 || scheduleTime) {
      const dayNames = scheduleWeekdays.map((d) => DAY_LABELS[d]).join(', ');
      parts.push(
        scheduleWeekdays.length > 0
          ? `Schedule: ${dayNames}${scheduleTime ? ` at ${scheduleTime}` : ''}`
          : `Schedule: ${scheduleTime}`,
      );
    }
    parts.push(buildStudyPlanText(sessions));

    createPlanFromFile(planId, {
      file,
      title: title.trim(),
      description: parts.join('\n\n'),
      type: 'weekly',
      status: 'in-progress',
      priority,
      category: categoryValue,
      date: resolvedDate,
    })
      .then((plan) => {
        onAddPlanFromFile(plan);
        setIsSubmitting(false);
        setCreatedTitle(plan.title);
        setIsSuccess(true);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
        setFileError(message);
        setIsSubmitting(false);
      });
  }

  function renderCalendar() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array.from({ length: startOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    return (
      <div className="rounded-[16px] border border-border bg-surface-hover/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setCalendarCursor(new Date(year, month - 1, 1))}
            aria-label="Previous month"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text hover:bg-surface transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium text-text">
            {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => setCalendarCursor(new Date(year, month + 1, 1))}
            aria-label="Next month"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text hover:bg-surface transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d} className="h-6 flex items-center justify-center text-[9px] text-text-muted">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const iso = toIsoDateString(new Date(year, month, day));
            const isSelected = iso === resolvedDate;
            const isToday = iso === todayIso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  setCustomDate(iso);
                  setCalendarOpen(false);
                }}
                aria-pressed={isSelected}
                className={`h-7 rounded-lg text-[11px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${
                  isSelected
                    ? 'bg-accent text-accent-contrast'
                    : isToday
                      ? 'text-accent bg-accent-muted'
                      : 'text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDocumentCard() {
    if (!file) {
      return (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            aria-label="Upload a document"
            className={`w-full rounded-[16px] border-2 border-dashed text-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${
              dragActive
                ? 'border-accent bg-accent-muted/40'
                : 'border-border hover:border-accent/50 hover:bg-surface-hover/40'
            }`}
          >
            <div className="flex flex-col items-center px-6 py-7">
              <motion.span
                animate={dragActive ? { y: -2, scale: 1.05 } : { y: 0, scale: 1 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-200 ${
                  dragActive ? 'bg-accent-muted' : 'bg-surface-hover'
                }`}
              >
                <FiUpload className={dragActive ? 'text-accent' : 'text-text-secondary'} size={19} />
              </motion.span>
              <span className="mt-3 text-sm font-medium text-text">
                {dragActive ? 'Drop to add document' : 'Drop a document here'}
              </span>
              <span className="mt-1 text-xs text-text-muted">PDF, Word, or TXT · Up to 25 MB</span>
              <span className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] border border-border-hover bg-surface text-[12px] font-medium text-text-secondary pointer-events-none">
                <FiPaperclip size={12} /> Browse files
              </span>
              <span className="mt-3 text-[11px] text-text-muted max-w-[280px]">
                We&rsquo;ll use your document to suggest a focused plan.
              </span>
            </div>
          </button>

          <div className="px-1 space-y-2">
            {[
              { icon: FiFileText, text: 'Suggest a clear plan title' },
              { icon: FiList, text: 'Organize the document into actionable steps' },
              { icon: FiPaperclip, text: 'Keep the source document attached' },
            ].map((row) => {
              const RowIcon = row.icon;
              return (
                <div key={row.text} className="flex items-center gap-2 text-[12px] text-text-muted">
                  <RowIcon size={14} className="text-accent shrink-0" />
                  {row.text}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (filePhase === 'processing') {
      return (
        <div className="rounded-[16px] border border-border bg-surface-hover/40 p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-[12px] bg-accent-muted flex items-center justify-center shrink-0">
            <FiFileText className="text-accent" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-text truncate">{file.name}</div>
            <div className="mt-2 h-1 rounded-full bg-surface-hover overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${processingProgress}%` }}
                transition={{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
          <span className="shrink-0 text-[11px] text-text-muted tabular-nums">{processingProgress}%</span>
        </div>
      );
    }

    return (
      <div className="rounded-[16px] border border-border bg-surface-hover/40 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-[12px] bg-accent-muted flex items-center justify-center shrink-0">
            {fileTypeLabel === 'PDF' ? (
              <FiFileText className="text-accent" size={18} />
            ) : (
              <FiFile className="text-accent" size={18} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-text truncate">{file.name}</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {fileTypeLabel} · {formatFileSize(file.size)}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 border border-success/15 rounded-full px-2 py-0.5 shrink-0">
            <FiCheck size={11} /> Ready to create a plan
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={previewFile}
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-[10px] text-xs font-medium text-text-secondary hover:text-text hover:bg-surface transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiEye size={12} /> Preview
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-[10px] text-xs font-medium text-text-secondary hover:text-text hover:bg-surface transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiRefreshCw size={12} /> Replace
          </button>
          <button
            type="button"
            onClick={removeFile}
            className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-[10px] text-xs font-medium text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            <FiTrash2 size={12} /> Remove
          </button>
        </div>
        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg px-1 py-1"
          >
            <FiInfo size={11} /> Document details
            <FiChevronDown
              size={12}
              className={`transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <AnimatePresence>
            {detailsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  <dt className="text-text-muted">Type</dt>
                  <dd className="text-text-secondary text-right">{fileTypeLabel}</dd>
                  <dt className="text-text-muted">Size</dt>
                  <dd className="text-text-secondary text-right">{formatFileSize(file.size)}</dd>
                  <dt className="text-text-muted">Format</dt>
                  <dd className="text-text-secondary text-right">{file.name.split('.').pop()?.toUpperCase() ?? '—'}</dd>
                  <dt className="text-text-muted">Page count</dt>
                  <dd className="text-text-secondary text-right">Detected on creation</dd>
                </dl>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  function renderSuggestion() {
    if (!file) return null;
    const suggestion = deriveSuggestion(file);
    const CatIcon = CATEGORIES.find((c) => c.id === suggestion.category)?.icon ?? FiFolder;
    const PrioIcon = PRIORITY_OPTIONS.find((p) => p.id === suggestion.priority)?.icon ?? FiMinus;
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }}
        className="overflow-hidden"
      >
        <div className="rounded-[16px] border border-accent/25 bg-accent-muted/30 p-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[12px] bg-accent-muted flex items-center justify-center shrink-0">
              <FiZap className="text-accent" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-text">Start from a suggestion</div>
              <div className="text-[11px] text-text-muted truncate mt-0.5">Based on &ldquo;{file.name}&rdquo;</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px] border border-border bg-surface text-[11px] font-medium text-text-secondary">
              <FiFileText size={11} className="text-accent" /> {suggestion.title}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px] border border-border bg-surface text-[11px] font-medium text-text-secondary">
              <CatIcon size={11} className="text-accent" /> {suggestion.category}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px] border border-border bg-surface text-[11px] font-medium text-text-secondary">
              <FiTarget size={11} className="text-accent" /> {suggestion.sessions} × {suggestion.minutes}m
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px] border border-border bg-surface text-[11px] font-medium text-text-secondary">
              <FiCalendar size={11} className="text-accent" /> Tomorrow
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-[10px] border border-border bg-surface text-[11px] font-medium ${PRIORITY_OPTIONS.find((p) => p.id === suggestion.priority)?.iconCls ?? ''}`}
            >
              <PrioIcon size={11} /> {suggestion.priority}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={useSuggestion}
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast rounded-[12px] px-3.5 h-9 text-[13px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
            >
              <FiCheck size={13} /> Use suggestion
            </button>
            <button
              type="button"
              onClick={customizeSuggestion}
              className="inline-flex items-center gap-1.5 rounded-[12px] border border-border bg-surface px-3.5 h-9 text-[13px] font-medium text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
            >
              <FiSliders size={13} /> Customize
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  function renderShapeSection() {
    const SelectedPrio = PRIORITY_OPTIONS.find((p) => p.id === priority);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.35, delay: reduced ? 0 : 0.05 }}
      >
        <div className="space-y-6">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-medium text-text-secondary">Plan title</span>
              {titleEditing && <span className="text-[11px] text-text-muted tabular-nums">{title.length}/100</span>}
            </div>
            <div className="mt-1.5">
              {titleEditing ? (
                <input
                  ref={titleInputRef}
                  autoFocus
                  type="text"
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setTitleEditing(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') setTitleEditing(false);
                  }}
                  aria-label="Plan title"
                  className="w-full bg-transparent text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-text placeholder-text-muted border-b border-border focus:border-accent focus:outline-none py-1 transition-colors"
                />
              ) : (
                <div className="flex items-center gap-2 group/title">
                  <button
                    type="button"
                    onClick={() => setTitleEditing(true)}
                    className="min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg"
                  >
                    <span
                      className={`block truncate text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] ${
                        title.trim() ? 'text-text' : 'text-text-muted'
                      }`}
                    >
                      {title.trim() || 'Your plan title'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTitleEditing(true)}
                    aria-label="Edit plan title"
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-text-muted opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100 hover:text-text hover:bg-surface-hover transition-all duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                  >
                    <FiEdit3 size={15} />
                  </button>
                </div>
              )}
            </div>
            <AnimatePresence>
              {titleEditing && (titleTooLong || (title.trim().length > 0 && !titleValid)) && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduced ? 0 : 0.2 }}
                  className="overflow-hidden mt-1.5 flex items-center gap-1.5 text-[11px] text-warning"
                >
                  <FiAlertCircle size={11} className="shrink-0" />
                  {titleTooLong ? 'Keep the title under 100 characters.' : 'Enter at least 3 characters.'}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Category */}
          <div>
            <span className="text-[13px] font-medium text-text-secondary block mb-2">Category</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const selected = category === c.id;
                const CatIcon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCategory(c.id);
                      if (c.id !== 'Custom') setCustomCategory('');
                    }}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-1.5 px-3.5 h-9 rounded-[12px] border text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${chipSelectedCls(selected)}`}
                  >
                    <CatIcon size={13} className={selected ? 'text-accent' : 'text-text-muted'} />
                    {c.id}
                    {selected && <FiCheck size={12} className="text-accent" />}
                  </button>
                );
              })}
            </div>
            <AnimatePresence>
              {category === 'Custom' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Custom category, e.g. Reading"
                    aria-label="Custom category"
                    className={`${inputCls} mt-2 max-w-[260px]`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Due date */}
          <div>
            <span className="text-[13px] font-medium text-text-secondary block mb-2">Due date</span>
            <div className="flex flex-wrap gap-2">
              {DUE_OPTIONS.map((opt) => {
                const selected = dueQuick === opt.id;
                const isCalendar = opt.id === 'custom';
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDueQuick(opt.id);
                      if (isCalendar) openCalendar();
                      else setCalendarOpen(false);
                    }}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-1.5 px-3.5 h-9 rounded-[12px] border text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${chipSelectedCls(selected)}`}
                  >
                    {opt.label}
                    {selected && !isCalendar && <FiCheck size={12} className="text-accent" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted">
              <FiCalendar size={11} className="text-accent shrink-0" />
              <span className="truncate">
                Resolved for <span className="text-text-secondary font-medium">{shortDate(resolvedDate)}</span>
              </span>
              {dueQuick === 'custom' && (
                <button
                  type="button"
                  onClick={() => setCalendarOpen((v) => !v)}
                  className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-accent hover:bg-accent-muted transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                >
                  <FiChevronDown
                    size={11}
                    className={`transition-transform duration-200 ${calendarOpen ? 'rotate-180' : ''}`}
                  />
                  Change
                </button>
              )}
            </div>
            <AnimatePresence>
              {dueQuick === 'custom' && calendarOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 max-w-[300px]">{renderCalendar()}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Priority */}
          <div>
            <span className="text-[13px] font-medium text-text-secondary block mb-2">Priority</span>
            <div className="flex items-center gap-1 bg-surface-hover rounded-[12px] p-1 border border-border max-w-[360px]">
              {PRIORITY_OPTIONS.map((p) => {
                const selected = priority === p.id;
                const PrioIcon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    aria-pressed={selected}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] h-9 text-[13px] font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${
                      selected
                        ? 'bg-surface text-text shadow-sm border border-border'
                        : 'text-text-secondary hover:text-text'
                    }`}
                  >
                    <PrioIcon size={13} className={selected ? p.iconCls : 'text-text-muted'} />
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-text-muted">{SelectedPrio?.desc}</p>
          </div>

          {/* Notes */}
          <div>
            {!notesOpen ? (
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg px-1 py-1"
              >
                <FiPlus size={14} /> Add notes or goals
              </button>
            ) : (
              <div>
                <span className="text-[13px] font-medium text-text-secondary block mb-2">
                  Notes or goals (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="What do you want to get out of this document?"
                  aria-label="Notes or goals"
                  className={`${inputCls} resize-none`}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['What should be completed?', 'What should you understand?', 'What is the success criteria?'].map(
                    (prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setNotes((prev) => (prev ? `${prev}\n${prompt}` : prompt))}
                        className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg border border-border-hover text-[11px] text-text-muted hover:text-text hover:border-border transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                      >
                        <FiPlus size={10} /> {prompt}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  function renderScheduleSummary() {
    const weekdays = scheduleWeekdays.map((d) => DAY_LABELS[d]).join(' · ');
    return (
      <div className="rounded-[12px] border border-border bg-surface p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-secondary font-medium">
            {sessionCount} sessions × {sessionMinutes} min
          </span>
          <span className="text-text-muted tabular-nums">{formatMinutes(totalMinutes)} total focus</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-muted">Finishes before</span>
          <span className="text-text-secondary font-medium">{shortDate(resolvedDate)}</span>
        </div>
        {(scheduleWeekdays.length > 0 || scheduleTime) && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">When</span>
            <span className="text-text-secondary font-medium truncate">
              {weekdays || 'Any day'}
              {scheduleTime ? ` at ${scheduleTime}` : ''}
            </span>
          </div>
        )}
        <div className="pt-1.5 border-t border-divider">
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <FiInfo size={10} className="shrink-0" /> Sessions adapt to your plan — mark them done as you go.
          </div>
        </div>
      </div>
    );
  }

  function renderScheduleCard() {
    const adjusted = scheduleMode === 'adjusted';
    const subtitle =
      scheduleMode === 'recommended'
        ? `${sessionCount} focused session${sessionCount !== 1 ? 's' : ''} · ${sessionMinutes} min each · spread across the next 6 days`
        : `${sessionCount} session${sessionCount !== 1 ? 's' : ''} · ${sessionMinutes} min each`;
    return (
      <div className="rounded-[16px] border border-border bg-surface-hover/40 p-4">
        <div className="flex items-start gap-2.5">
          <span className="w-9 h-9 rounded-[12px] bg-accent-muted flex items-center justify-center shrink-0">
            <FiTarget className="text-accent" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-text">Schedule</div>
            <div className="text-[11px] text-text-muted mt-0.5 leading-snug">{subtitle}</div>
          </div>
        </div>

        <AnimatePresence>
          {scheduleMode === 'recommended' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleMode('accepted')}
                  className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast rounded-[12px] px-3.5 h-9 text-[13px] font-semibold transition-colors duration-200 active:opacity-80 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                >
                  <FiCheck size={13} /> Accept schedule
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('adjusted')}
                  className="inline-flex items-center gap-1.5 rounded-[12px] border border-border bg-surface px-3.5 h-9 text-[13px] font-medium text-text-secondary hover:text-text hover:bg-surface-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                >
                  <FiSliders size={13} /> Adjust
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-text-muted">
                <span className="tabular-nums">{formatMinutes(totalMinutes)} total</span>
                <span className="inline-flex items-center gap-1">
                  <FiCalendar size={10} /> Finishes before {shortDate(resolvedDate)}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(scheduleMode === 'accepted' || adjusted) && (
          <div className="mt-3">
            {renderScheduleSummary()}
            <button
              type="button"
              onClick={() => setScheduleMode(adjusted ? 'accepted' : 'adjusted')}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg px-1 py-1"
            >
              <FiSliders size={11} /> {adjusted ? 'Done adjusting' : 'Adjust schedule'}
            </button>
          </div>
        )}

        <AnimatePresence>
          {adjusted && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduced ? 0 : 0.22, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border space-y-3.5">
                <div>
                  <span className="text-[11px] font-medium text-text-secondary block mb-1.5">Number of sessions</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSessionCount((v) => Math.max(MIN_SESSIONS, v - 1))}
                      aria-label="Fewer sessions"
                      className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center text-text-secondary hover:text-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                    >
                      <FiMinus size={14} />
                    </button>
                    <span className="w-12 text-center text-[16px] font-semibold text-text tabular-nums">
                      {sessionCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSessionCount((v) => Math.min(MAX_SESSIONS, v + 1))}
                      aria-label="More sessions"
                      className="w-9 h-9 rounded-xl border border-border bg-surface flex items-center justify-center text-text-secondary hover:text-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                    >
                      <FiPlus size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-text-secondary block mb-1.5">Session length</span>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_CHIPS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSessionMinutes(m)}
                        aria-pressed={sessionMinutes === m}
                        className={`inline-flex items-center justify-center px-3 h-8 rounded-[10px] border text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${chipSelectedCls(sessionMinutes === m)}`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-text-secondary block mb-1.5">
                    Preferred days (optional)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleWeekday(i)}
                        aria-pressed={scheduleWeekdays.includes(i)}
                        aria-label={WEEKDAY_NAMES[i]}
                        className={`w-9 h-9 rounded-[10px] text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${
                          scheduleWeekdays.includes(i)
                            ? 'bg-accent text-accent-contrast'
                            : 'bg-surface-hover text-text-muted border border-border-hover hover:border-border'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-medium text-text-secondary block mb-1.5">
                    Preferred time (optional)
                  </span>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    aria-label="Preferred time"
                    className={inputCls}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-text-secondary">Spread over the next 6 days</span>
                    <span className="text-[11px] text-text-muted tabular-nums">
                      {formatMinutes(totalMinutes)} total
                    </span>
                  </div>
                  <div className="mt-2 flex items-end gap-1.5 h-12">
                    {timeline.map((t) => (
                      <div key={t.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                        <span
                          className={`text-[9px] tabular-nums ${t.count > 0 ? 'text-text-secondary' : 'text-text-muted'}`}
                        >
                          {t.count > 0 ? t.count : ''}
                        </span>
                        <div
                          className={`w-full rounded-t-[4px] transition-colors duration-150 ${
                            t.count > 0 ? 'bg-gradient-to-t from-accent to-accent-hover' : 'bg-surface-hover'
                          }`}
                          style={{ height: `${Math.max(6, (t.count / Math.max(1, sessionCount)) * 100)}%` }}
                        />
                        <span className="text-[9px] text-text-muted">
                          {t.date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  function renderPlanPreview() {
    const CatIcon = CATEGORIES.find((c) => c.id === category)?.icon ?? FiFolder;

    let content;
    if (filePhase === 'processing' && file) {
      content = (
        <motion.div
          key="processing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mt-3 flex items-center gap-2 text-[12px] text-text-muted"
        >
          <FiLoader size={13} className="animate-spin shrink-0" /> Preparing your plan…
        </motion.div>
      );
    } else if (fileReady) {
      const previewDesc = notes.trim()
        ? notes.trim()
        : 'Work through the uploaded material, identify the important concepts, and prepare for the exam.';
      content = (
        <motion.div
          key="populated"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }}
          className="mt-3 space-y-3"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-[10px] bg-accent-muted flex items-center justify-center shrink-0">
              <CatIcon size={15} className="text-accent" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-text truncate">{title.trim() || 'Your plan title'}</div>
              <div className="text-[11px] text-text-muted truncate mt-0.5">{file?.name}</div>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-text-secondary">{previewDesc}</p>
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-text-muted">Suggested steps</div>
            <ol className="mt-2 space-y-1.5">
              {sessions.slice(0, 3).map((s) => (
                <li key={s.index} className="flex items-center gap-2 text-[12px] text-text-secondary">
                  <span className="w-4 h-4 rounded-full bg-accent-muted flex items-center justify-center text-[9px] font-semibold text-accent shrink-0">
                    {s.index}
                  </span>
                  <span className="truncate">{s.title}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-text-muted tabular-nums">{s.minutes} min</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="pt-2 border-t border-divider flex items-center justify-between gap-2 text-[11px] text-text-muted">
            <span className="tabular-nums">
              {sessionCount} sessions · {formatMinutes(totalMinutes)} total
            </span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <FiCalendar size={10} className="text-accent" /> Finishes {shortDate(resolvedDate)}
            </span>
          </div>
        </motion.div>
      );
    } else {
      content = (
        <motion.div
          key="placeholder"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
        >
          <div className="mt-3 rounded-[14px] border border-dashed border-border/70 bg-surface/40 p-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-[10px] bg-surface-hover flex items-center justify-center shrink-0">
                <FiTarget size={14} className="text-text-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-text-muted">Review biology exam notes</div>
                <div className="text-[10px] text-text-muted/70 mt-0.5">Example preview</div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-text-muted/80">
              Work through the uploaded material, identify the important concepts, and prepare for the exam.
            </p>
            <ol className="mt-3 space-y-1.5">
              {['Review the main chapters', 'Mark difficult concepts', 'Create a short revision summary'].map(
                (step, i) => (
                  <li key={step} className="flex items-center gap-2 text-[12px] text-text-muted/70">
                    <span className="w-4 h-4 rounded-full bg-surface-hover flex items-center justify-center text-[9px] font-semibold text-text-muted shrink-0">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ),
              )}
            </ol>
          </div>
        </motion.div>
      );
    }

    return (
      <div className="rounded-[16px] border border-border bg-surface-hover/40 p-4">
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <FiEye size={12} className="text-accent shrink-0" /> Your plan will take shape here
        </div>
        <AnimatePresence mode="wait">{content}</AnimatePresence>
      </div>
    );
  }

  function renderRightColumn() {
    return (
      <div className="space-y-4">
        {renderPlanPreview()}
        {fileReady && renderScheduleCard()}
      </div>
    );
  }

  function renderActionBar() {
    const hint = !file
      ? { icon: FiInfo, text: 'Add a document to continue.', cls: 'text-text-muted' }
      : filePhase === 'processing'
        ? { icon: FiLoader, text: 'Preparing your document…', cls: 'text-text-muted' }
        : titleTooLong
          ? { icon: FiAlertCircle, text: 'Keep the title under 100 characters.', cls: 'text-warning' }
          : !titleValid
            ? { icon: FiAlertCircle, text: 'Enter a plan title to continue.', cls: 'text-text-muted' }
            : {
                icon: FiCheckCircle,
                text: 'Document ready. Review the suggested plan before creating it.',
                cls: 'text-success',
              };
    const HintIcon = hint.icon;
    return (
      <div className="mt-6 pt-5 border-t border-divider">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs min-w-0" aria-live="polite">
            <HintIcon size={13} className={`${hint.cls} shrink-0`} />
            <span className={`${hint.cls} truncate`}>{hint.text}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="shrink-0 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-contrast rounded-[12px] px-4 h-10 text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent disabled:active:scale-100 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
          >
            {isSubmitting ? (
              <>
                <FiLoader size={14} className="animate-spin" /> Creating your plan…
              </>
            ) : (
              <>
                <FiZap size={14} /> Create plan
              </>
            )}
          </button>
        </div>
        {isSubmitting && (
          <div className="mt-2 h-0.5 rounded-full bg-surface-hover overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-accent"
              style={{ width: '38%' }}
              initial={{ x: '-100%' }}
              animate={{ x: '360%' }}
              transition={{ duration: reduced ? 0 : 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card-glass rounded-[22px] relative overflow-hidden">
      {/* Workspace header */}
      <div className="px-6 sm:px-7 pt-6 sm:pt-7 pb-5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-[12px] bg-accent-muted flex items-center justify-center shrink-0">
            <FiPlus className="text-accent" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-text">Create a new plan</h2>
            <p className="text-[13px] text-text-muted mt-0.5">Turn a goal or document into an actionable plan.</p>
          </div>
        </div>
      </div>

      {/* Creation method */}
      <div className="px-6 sm:px-7">
        <div
          role="tablist"
          aria-label="Plan creation method"
          className="flex items-center gap-1 bg-surface-hover rounded-xl p-1 border border-border w-full sm:w-fit sm:min-w-[360px]"
        >
          {(
            [
              { id: 'manual', label: 'Create manually', icon: FiEdit3 },
              { id: 'file', label: 'Create from a file', icon: FiUpload },
            ] as { id: 'manual' | 'file'; label: string; icon: IconType }[]
          ).map((tab) => {
            const TabIcon = tab.icon;
            const selected = mode === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={selected}
                onClick={() => {
                  setManualPreset(null);
                  setMode(tab.id);
                }}
                className={`relative flex flex-1 items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${
                  selected ? 'text-text' : 'text-text-secondary hover:text-text'
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="plan-create-mode"
                    className="absolute inset-0 rounded-lg bg-surface border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_10px_rgba(0,0,0,0.06)]"
                    transition={{ type: 'tween', duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
                  />
                )}
                <TabIcon size={15} className={`relative z-10 ${selected ? 'text-accent' : ''}`} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 sm:px-7 pt-6 pb-6 sm:pb-7">
        {mode === 'manual' ? (
          <InlinePlanCreator
            onAddPlan={onAddPlan}
            openRequest={openRequest}
            presetTitle={manualPreset?.title}
            presetKey={manualPreset?.key}
          />
        ) : (
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
                role="status"
                aria-live="polite"
                className="flex items-center gap-3"
              >
                <span className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                  <FiCheckCircle className="text-success" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium text-text">Plan created</div>
                  <div className="text-xs text-text-muted mt-0.5 truncate">{createdTitle || title || 'Your plan'}</div>
                </div>
                <button
                  onClick={resetForm}
                  className="shrink-0 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg px-2 py-1"
                >
                  Create another
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />

                {fileError && (
                  <div
                    className="mb-4 flex items-center gap-2 rounded-[12px] border border-danger/20 bg-danger/10 px-3.5 py-2.5 text-xs text-danger"
                    role="alert"
                  >
                    <FiAlertCircle size={13} className="shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}

                <div className="lg:grid lg:grid-cols-5 lg:gap-6">
                  <div className="lg:col-span-3 space-y-6">
                    {renderDocumentCard()}

                    <AnimatePresence>{fileReady && suggestionShown && renderSuggestion()}</AnimatePresence>

                    <AnimatePresence>{fileReady && renderShapeSection()}</AnimatePresence>

                    {fileReady && titleValid && signals && (
                      <AssistantSuggestions signals={signals} draft={draft} onApply={applyPatch} />
                    )}
                  </div>

                  <div className="lg:hidden mt-6">{renderRightColumn()}</div>

                  <div className="hidden lg:block lg:col-span-2">
                    <div className="sticky top-4">{renderRightColumn()}</div>
                  </div>
                </div>

                {renderActionBar()}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
