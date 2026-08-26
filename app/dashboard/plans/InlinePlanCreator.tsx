'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  FiTarget,
  FiCheckCircle,
  FiPlus,
  FiCalendar,
  FiList,
  FiTrash2,
  FiEye,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiAlertCircle,
  FiLoader,
  FiArrowRight,
  FiArrowDown,
  FiArrowUp,
  FiMinus,
  FiCheck,
  FiEdit3,
} from 'react-icons/fi';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { toIsoDateString } from '@/src/utils/date';
import type { IconType } from 'react-icons';
import type { Plan, PlanPriority, PlanTypeValue } from '@/src/types';
import AssistantSuggestions from './AssistantSuggestions';
import { usePlanningSignals } from '@/lib/assistant/usePlanningSignals';
import type { DraftPatch, PlanDraft } from '@/lib/assistant/types';

interface InlinePlanCreatorProps {
  onAddPlan: (plan: Omit<Plan, 'id' | 'status'>) => void;
  openRequest?: number;
  presetTitle?: string;
  presetKey?: number;
}

interface PlanStep {
  id: string;
  title: string;
}

type PlanStyle = 'simple' | 'steps' | 'habit';
type Timeframe = 'today' | 'tomorrow' | 'week' | 'custom';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const inputCls =
  'w-full px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:ring-1 focus:ring-accent/40 focus:border-accent/40 transition-all';

const QUICK_STARTS = ['Prepare for an exam', 'Finish a project', 'Learn a new skill', 'Build a routine'];

const TIMEFRAMES: { id: Timeframe; label: string; icon?: IconType }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'This week' },
  { id: 'custom', label: 'Custom', icon: FiCalendar },
];

const STRUCTURES: { id: PlanStyle; icon: IconType; label: string; desc: string }[] = [
  { id: 'simple', icon: FiTarget, label: 'Simple goal', desc: 'Track one clear outcome.' },
  { id: 'steps', icon: FiList, label: 'Step-by-step', desc: 'Break your goal into steps.' },
  { id: 'habit', icon: FiRefreshCw, label: 'Habit', desc: 'Build consistency.' },
];

const PRIORITIES: { id: PlanPriority; icon: IconType; label: string; chip: string }[] = [
  { id: 'low', icon: FiArrowDown, label: 'Low', chip: 'bg-info/10 text-info border border-info/15' },
  { id: 'medium', icon: FiMinus, label: 'Medium', chip: 'bg-warning/10 text-warning border border-warning/15' },
  { id: 'high', icon: FiArrowUp, label: 'High', chip: 'bg-danger/10 text-danger border border-danger/15' },
];

function chipSelectedCls(selected: boolean) {
  return selected
    ? 'border-accent bg-accent-muted text-text shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
    : 'border-border-hover text-text-secondary hover:border-border hover:text-text';
}

export default function InlinePlanCreator({
  onAddPlan,
  openRequest = 0,
  presetTitle,
  presetKey = 0,
}: InlinePlanCreatorProps) {
  const reduced = useReducedMotion();
  const { signals } = usePlanningSignals();
  const [phase, setPhase] = useState<'start' | 'form'>('start');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>('today');
  const [customDate, setCustomDate] = useState('');
  const [planStyle, setPlanStyle] = useState<PlanStyle>('simple');
  const [priority, setPriority] = useState<PlanPriority>('medium');
  const [description, setDescription] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [steps, setSteps] = useState<PlanStep[]>([{ id: '1', title: '' }]);
  const [habitFreq, setHabitFreq] = useState<'daily' | 'weekdays' | 'custom'>('daily');
  const [habitDays, setHabitDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [preferredTime, setPreferredTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const startInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const stepInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const todayIso = toIsoDateString(new Date());
  const titleValid = title.trim().length >= 3;
  const titleTooLong = title.length > 100;
  const stepCount = steps.filter((s) => s.title.trim()).length;
  const canSubmit = titleValid && !titleTooLong && (planStyle !== 'steps' || stepCount > 0) && !isSubmitting;

  const planDate = (() => {
    if (timeframe === 'today') return todayIso;
    if (timeframe === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return toIsoDateString(d);
    }
    if (timeframe === 'week') return todayIso;
    return customDate || todayIso;
  })();

  const draft: PlanDraft = useMemo(
    () => ({
      title: title.trim() || undefined,
      category: 'Work',
      priority,
      type: planStyle === 'steps' ? 'weekly' : planStyle === 'habit' ? 'monthly' : 'daily',
      date: planDate,
    }),
    [title, priority, planStyle, planDate],
  );

  function applyPatch(patch: DraftPatch) {
    if (patch.date) {
      const tomorrow = toIsoDateString(new Date(Date.now() + 86400000));
      if (patch.date === todayIso) {
        setTimeframe('today');
        setCustomDate('');
      } else if (patch.date === tomorrow) {
        setTimeframe('tomorrow');
        setCustomDate('');
      } else {
        setTimeframe('custom');
        setCustomDate(patch.date);
      }
    }
    if (patch.priority) setPriority(patch.priority);
    if (patch.descriptionAppend) {
      setNotesOpen(true);
      setDescription((prev) =>
        prev.includes(patch.descriptionAppend!)
          ? prev
          : prev
            ? `${prev}\n${patch.descriptionAppend}`
            : patch.descriptionAppend!,
      );
    }
  }

  useEffect(() => {
    if (presetKey > 0 && presetTitle) {
      const t = window.setTimeout(() => {
        setTitle(presetTitle);
        setTitleTouched(true);
        setPhase('form');
        requestAnimationFrame(() => titleInputRef.current?.focus());
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [presetKey, presetTitle]);

  useEffect(() => {
    if (openRequest > 0) {
      const t = window.setTimeout(() => {
        setPhase('start');
        requestAnimationFrame(() => startInputRef.current?.focus());
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [openRequest]);

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => resetForm(), 2200);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

  function resetForm() {
    setPhase('start');
    setTitle('');
    setTitleTouched(false);
    setTitleEditing(false);
    setTimeframe('today');
    setCustomDate('');
    setPlanStyle('simple');
    setPriority('medium');
    setDescription('');
    setNotesOpen(false);
    setSteps([{ id: '1', title: '' }]);
    setHabitFreq('daily');
    setHabitDays([0, 1, 2, 3, 4]);
    setPreferredTime('');
    setIsSubmitting(false);
    setIsSuccess(false);
    setShowPreview(true);
  }

  function handleContinue() {
    if (!titleValid || titleTooLong) return;
    setTitleTouched(true);
    setPhase('form');
  }

  function handleAddStep() {
    const newId = String(Date.now());
    setSteps((prev) => [...prev, { id: newId, title: '' }]);
    setTimeout(() => {
      const idx = steps.length;
      stepInputRefs.current[idx]?.focus();
    }, 50);
  }

  function handleStepChange(id: string, value: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, title: value } : s)));
  }

  function handleRemoveStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function toggleDay(d: number) {
    setHabitDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function handleSubmit() {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    let type: PlanTypeValue = 'daily';
    let desc = description.trim();
    if (planStyle === 'steps') {
      type = 'weekly';
      const stepText = steps
        .filter((s) => s.title.trim())
        .map((s, i) => `${i + 1}. ${s.title.trim()}`)
        .join('\n');
      desc = desc ? `${desc}\n\nSteps:\n${stepText}` : `Steps:\n${stepText}`;
    } else if (planStyle === 'habit') {
      type = 'monthly';
      const freqText = `Frequency: ${habitFreq}${
        habitFreq === 'custom' ? ` (${habitDays.map((d) => DAY_LABELS[d]).join(', ')})` : ''
      }${preferredTime ? ` at ${preferredTime}` : ''}`;
      desc = desc ? `${desc}\n\n${freqText}` : freqText;
    }
    setTimeout(() => {
      onAddPlan({ title: title.trim(), description: desc, type, priority, category: 'Work', date: planDate });
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 500);
  }

  function renderPreview() {
    const styleLabel = planStyle === 'simple' ? 'Simple goal' : planStyle === 'steps' ? 'Step-by-step' : 'Habit';
    const PlanStyleIcon = STRUCTURES.find((s) => s.id === planStyle)?.icon ?? FiTarget;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] text-text-muted mb-1">
          <FiEye size={12} /> Live preview
        </div>
        <div className="bg-surface-hover rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
              <PlanStyleIcon className="text-accent" size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text truncate">{title || 'Untitled plan'}</div>
              <div className="text-[10px] text-text-muted">{styleLabel}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-muted flex items-center gap-1">
              <FiCalendar size={9} /> {planDate}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${PRIORITIES.find((p) => p.id === priority)?.chip ?? ''}`}
            >
              {(() => {
                const PrioIcon = PRIORITIES.find((p) => p.id === priority)?.icon ?? FiMinus;
                return <PrioIcon size={9} />;
              })()}
              {priority}
            </span>
          </div>
          {planStyle === 'steps' && stepCount > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-1.5">
                <FiList size={10} /> {stepCount} step{stepCount !== 1 ? 's' : ''}
              </div>
              <div className="space-y-1">
                {steps
                  .filter((s) => s.title.trim())
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-[11px] text-text-secondary">
                      <div className="w-4 h-4 rounded border border-border flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-sm bg-accent/40" />
                      </div>
                      <span className="truncate">{s.title}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {planStyle === 'habit' && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-1.5">
                <FiRefreshCw size={10} />{' '}
                {habitFreq === 'daily' ? 'Every day' : habitFreq === 'weekdays' ? 'Weekdays' : 'Custom days'}
              </div>
              {habitFreq === 'custom' && (
                <div className="flex gap-1">
                  {DAY_LABELS.map((d, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-medium ${
                        habitDays.includes(i) ? 'bg-accent text-accent-contrast' : 'bg-surface text-text-muted'
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderStartPhase() {
    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="plan-goal" className="text-[14px] font-medium text-text-secondary block mb-2">
            What do you want to accomplish?
          </label>
          <input
            id="plan-goal"
            ref={startInputRef}
            type="text"
            value={title}
            maxLength={100}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && titleValid && !titleTooLong) handleContinue();
            }}
            placeholder="e.g. Review for my biology exam"
            className={`${inputCls} text-base`}
          />
          {titleTouched && titleTooLong && (
            <p className="mt-1 text-[11px] text-warning">Keep the title under 100 characters.</p>
          )}
        </div>

        <div>
          <span className="text-[12px] text-text-muted block mb-2">Suggested starting points</span>
          <div className="flex flex-wrap gap-2">
            {QUICK_STARTS.map((q) => {
              const selected = title.trim().toLowerCase() === q.toLowerCase();
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setTitle(q)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-1.5 px-3.5 h-9 rounded-[12px] border text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${chipSelectedCls(selected)}`}
                >
                  {selected && <FiCheck size={12} className="text-accent" />}
                  {q}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!titleValid || titleTooLong}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-accent-contrast rounded-[12px] px-4 h-10 text-[13px] font-semibold transition-colors duration-200 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
          >
            Continue <FiArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  function renderFormPhase() {
    const statusHint = !titleValid
      ? { icon: FiTarget, text: 'Enter a title to continue.', cls: 'text-text-muted' }
      : titleTooLong
        ? { icon: FiAlertCircle, text: 'Keep the title under 100 characters.', cls: 'text-warning' }
        : planStyle === 'steps' && stepCount === 0
          ? { icon: FiAlertCircle, text: 'Add at least one step.', cls: 'text-warning' }
          : { icon: FiCheckCircle, text: 'Your plan is ready to create.', cls: 'text-success' };
    const HintIcon = statusHint.icon;

    return (
      <div>
        <div className="lg:grid lg:grid-cols-5 lg:gap-6">
          <div className="lg:col-span-3 space-y-5">
            {/* Editable title row */}
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
                    className="w-full bg-transparent text-[22px] font-semibold tracking-[-0.02em] text-text placeholder-text-muted border-b border-border focus:border-accent focus:outline-none py-1 transition-colors"
                  />
                ) : (
                  <div className="flex items-center gap-2 group/title">
                    <span className="min-w-0 flex-1 truncate text-[22px] font-semibold tracking-[-0.02em] text-text">
                      {title.trim() || 'Your plan title'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTitleEditing(true)}
                      aria-label="Edit plan title"
                      className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-text-muted opacity-0 group-hover/title:opacity-100 focus-visible:opacity-100 hover:text-text hover:bg-surface-hover transition-all duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                    >
                      <FiEdit3 size={15} />
                    </button>
                  </div>
                )}
              </div>
              {titleEditing && (titleTooLong || (title.trim().length > 0 && !titleValid)) && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-warning">
                  <FiAlertCircle size={11} className="shrink-0" />
                  {titleTooLong ? 'Keep the title under 100 characters.' : 'Enter at least 3 characters.'}
                </p>
              )}
            </div>

            {/* Timeframe */}
            <div>
              <span className="text-xs text-text-secondary block mb-2">Choose a timeframe</span>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAMES.map((tf) => {
                  const selected = timeframe === tf.id;
                  const TfIcon = tf.icon;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => setTimeframe(tf.id)}
                      aria-pressed={selected}
                      className={`flex items-center gap-1.5 px-3.5 h-9 rounded-xl border text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${chipSelectedCls(selected)}`}
                    >
                      {TfIcon && <TfIcon size={13} className={selected ? 'text-accent' : 'text-text-muted'} />}
                      {tf.label}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence>
                {timeframe === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 max-w-[220px]">
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        aria-label="Custom target date"
                        className={inputCls}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Structure */}
            <div>
              <span className="text-xs text-text-secondary block mb-2">How do you want to organize it?</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {STRUCTURES.map((opt) => {
                  const selected = planStyle === opt.id;
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPlanStyle(opt.id)}
                      aria-pressed={selected}
                      className={`relative p-3 rounded-xl border text-left transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${chipSelectedCls(selected)}`}
                    >
                      {selected && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                          <FiCheck size={10} className="text-accent-contrast" />
                        </span>
                      )}
                      <OptIcon size={16} className={selected ? 'text-accent' : 'text-text-secondary'} />
                      <span
                        className={`block text-xs font-medium mt-2 ${selected ? 'text-text' : 'text-text-secondary'}`}
                      >
                        {opt.label}
                      </span>
                      <span className="block text-[10px] text-text-muted mt-0.5 leading-tight">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {planStyle === 'steps' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-2">
                      {steps.map((step, idx) => (
                        <div key={step.id} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-surface-hover border border-border flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-medium text-text-muted">{idx + 1}</span>
                          </div>
                          <input
                            ref={(el) => {
                              stepInputRefs.current[idx] = el;
                            }}
                            type="text"
                            value={step.title}
                            onChange={(e) => handleStepChange(step.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (step.title.trim()) handleAddStep();
                              }
                            }}
                            placeholder={`Step ${idx + 1}`}
                            aria-label={`Step ${idx + 1}`}
                            className={inputCls}
                          />
                          <button
                            onClick={() => handleRemoveStep(step.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-all shrink-0"
                            aria-label={`Remove step ${idx + 1}`}
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleAddStep}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-accent hover:bg-accent-muted transition-all focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                    >
                      <FiPlus size={13} /> Add another step
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {planStyle === 'habit' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 space-y-3">
                      <div>
                        <span className="text-[11px] text-text-secondary block mb-1.5">Frequency</span>
                        <div className="flex gap-2">
                          {(['daily', 'weekdays', 'custom'] as const).map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setHabitFreq(f)}
                              aria-pressed={habitFreq === f}
                              className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${chipSelectedCls(habitFreq === f)}`}
                            >
                              {f === 'daily' ? 'Every day' : f === 'weekdays' ? 'Weekdays' : 'Custom'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {habitFreq === 'custom' && (
                        <div>
                          <span className="text-[11px] text-text-secondary block mb-1.5">Select days</span>
                          <div className="flex gap-1.5">
                            {DAY_LABELS.map((d, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => toggleDay(i)}
                                aria-pressed={habitDays.includes(i)}
                                aria-label={`Day ${d}`}
                                className={`w-10 h-10 rounded-xl text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${
                                  habitDays.includes(i)
                                    ? 'bg-accent text-accent-contrast'
                                    : 'bg-surface-hover text-text-muted border border-border-hover hover:border-border'
                                }`}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-[11px] text-text-secondary block mb-1.5">Preferred time (optional)</span>
                        <input
                          type="time"
                          value={preferredTime}
                          onChange={(e) => setPreferredTime(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Priority */}
            <div>
              <span className="text-xs text-text-secondary block mb-2">Priority</span>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => {
                  const selected = priority === p.id;
                  const PrioIcon = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriority(p.id)}
                      aria-pressed={selected}
                      className={`flex items-center gap-1.5 px-3.5 h-9 rounded-xl border text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${chipSelectedCls(selected)}`}
                    >
                      <PrioIcon
                        size={13}
                        className={
                          selected
                            ? p.chip.includes('danger')
                              ? 'text-danger/70'
                              : p.chip.includes('warning')
                                ? 'text-warning/70'
                                : 'text-info/70'
                            : 'text-text-muted'
                        }
                      />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              {!notesOpen ? (
                <button
                  type="button"
                  onClick={() => setNotesOpen(true)}
                  className="flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg px-1 py-1"
                >
                  <FiPlus size={14} /> Add notes
                </button>
              ) : (
                <div>
                  <span className="text-xs text-text-secondary block mb-1.5">Notes (optional)</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Add context or notes for your plan."
                    aria-label="Notes"
                    className={`${inputCls} resize-none`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: preview (desktop) */}
          <div className="hidden lg:block lg:col-span-2">
            <div className="sticky top-4 pt-1">{renderPreview()}</div>
          </div>
        </div>

        {/* Mobile preview toggle */}
        <div className="lg:hidden mt-4">
          <button
            onClick={() => setShowPreview((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text transition-colors"
          >
            <FiEye size={13} /> Preview plan
            {showPreview ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
          </button>
          <AnimatePresence>
            {showPreview && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-3"
              >
                {renderPreview()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action bar */}
        <div className="mt-5 pt-4 border-t border-divider">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs" aria-live="polite">
              <HintIcon size={12} className={statusHint.cls} />
              <span className={statusHint.cls}>{statusHint.text}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetForm}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-text-secondary hover:text-text hover:bg-surface-hover transition-all focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className="inline-flex items-center gap-2 rounded-[14px] bg-accent hover:bg-accent-hover active:scale-[0.98] text-accent-contrast px-5 h-11 text-sm font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
              >
                {isSubmitting ? (
                  <>
                    <FiLoader className="animate-spin" size={14} /> Creating&hellip;
                  </>
                ) : (
                  <>
                    <FiPlus size={15} /> Create plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {signals && titleValid && (
          <div className="mt-5 pt-2">
            <AssistantSuggestions signals={signals} draft={draft} onApply={applyPatch} />
          </div>
        )}
      </div>
    );
  }

  return (
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
            <div className="text-xs text-text-muted mt-0.5 truncate">{title}</div>
          </div>
          <button
            onClick={resetForm}
            className="shrink-0 text-[13px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none rounded-lg px-2 py-1"
          >
            Create another
          </button>
        </motion.div>
      ) : (
        <motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
        >
          {phase === 'start' ? renderStartPhase() : renderFormPhase()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
