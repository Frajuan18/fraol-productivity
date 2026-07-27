'use client';

import { memo, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiPlay, FiPause, FiRotateCcw, FiX, FiPlus, FiEdit2, FiZap, FiClock } from 'react-icons/fi';
import { useTimer, partsToSeconds } from '@/src/hooks/useTimer';
import { PRESET_DURATIONS, QUICK_TASKS, DEFAULT_TASK } from '@/src/constants';
import { formatSecondsAsClock, formatSecondsAsDuration } from '@/src/utils/time';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import type { Session } from '@/src/types';

const ADD_TIME_OPTIONS = [
  { label: '+5m', seconds: 300 },
  { label: '+10m', seconds: 600 },
  { label: '+15m', seconds: 900 },
];

interface SessionTimerProps {
  onSessionComplete: (session: Session) => void;
  taskTypes: string[];
  onAddTaskType: (type: string) => void;
  onRemoveTaskType: (type: string) => void;
}

export const SessionTimer = memo(function SessionTimer({
  onSessionComplete,
  taskTypes,
  onAddTaskType,
  onRemoveTaskType,
}: SessionTimerProps) {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [selectedTask, setSelectedTask] = useState(DEFAULT_TASK);
  const [customTaskInput, setCustomTaskInput] = useState('');
  const [showCustomTask, setShowCustomTask] = useState(false);
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [showAddTypeInput, setShowAddTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const startTimestampRef = useRef<Date | null>(null);

  const allTaskTypes = useMemo(() => [...QUICK_TASKS, ...taskTypes], [taskTypes]);

  function handleAutoComplete() {
    const taskName = showCustomTask ? customTaskInput : selectedTask;
    const endTime = new Date();
    const startTime = startTimestampRef.current || new Date();
    const elapsedMs = endTime.getTime() - startTime.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const actualHours = Math.floor(elapsedSeconds / 3600);
    const actualMinutes = Math.floor((elapsedSeconds % 3600) / 60);

    const session: Session = {
      id: Date.now(),
      task: taskName || 'Focus Session',
      duration: formatSecondsAsDuration(elapsedSeconds),
      date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      status: 'Completed',
      startTime: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      endTime: endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      actualDuration: actualHours > 0 ? `${actualHours}h ${actualMinutes}m` : `${actualMinutes}m`,
    };

    onSessionComplete(session);
    resetSession();
  }

  const timer = useTimer({
    initialSeconds: partsToSeconds(0, 25, 0),
    onComplete: handleAutoComplete,
  });

  function handleStartSession() {
    const taskName = showCustomTask ? customTaskInput : selectedTask;
    if (taskName?.trim()) {
      setIsSessionActive(true);
      startTimestampRef.current = new Date();
      timer.start();
    }
  }

  function handleAddTime(seconds: number) {
    timer.addTime(seconds);
    if (!timer.isRunning) {
      timer.start();
    }
  }

  function resetSession() {
    setIsSessionActive(false);
    timer.reset();
    setSelectedTask(DEFAULT_TASK);
    setCustomTaskInput('');
    setShowCustomTask(false);
    startTimestampRef.current = null;
  }

  function applyPreset(hours: number, minutes: number, seconds: number) {
    timer.setDurationFromParts(hours, minutes, seconds);
    setShowCustomTime(false);
  }

  const taskName = useMemo(
    () => (showCustomTask ? customTaskInput : selectedTask || 'Focus Session'),
    [showCustomTask, customTaskInput, selectedTask],
  );

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-surface-hover rounded-xl">
          <FiZap className="text-text-secondary" size={18} />
        </div>
        <h3 className="text-sm font-medium text-text">Start a New Session</h3>
      </div>

      <motion.div key={isSessionActive ? 'active' : 'setup'} layout>
        {!isSessionActive ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex flex-col items-center justify-center bg-surface-hover rounded-2xl p-8 border border-border">
              <div className="text-center">
                <div className="text-sm text-text-secondary mb-2">Ready to Focus</div>
                <div className="text-6xl font-bold text-text font-mono tracking-wider">
                  {formatSecondsAsClock(timer.totalSeconds)}
                </div>
                <div className="mt-3 text-sm text-text-muted">{taskName}</div>
                <div className="mt-6 flex items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-text-secondary">Ready to start</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs text-text-secondary block mb-3">Select Task</label>
                <div className="flex flex-wrap gap-2">
                  {allTaskTypes.map((task) => {
                    const isCustom = taskTypes.includes(task);
                    return (
                      <div key={task} className="relative group">
                        <button
                          onClick={() => {
                            setSelectedTask(task);
                            setShowCustomTask(false);
                          }}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            selectedTask === task && !showCustomTask
                              ? 'bg-accent text-white'
                              : 'bg-surface-hover text-text-secondary hover:text-text hover:bg-surface-hover'
                          }`}
                        >
                          {task}
                        </button>
                        {isCustom && (
                          <button
                            onClick={() => onRemoveTaskType(task)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={`Remove ${task}`}
                          >
                            <FiX size={8} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!showAddTypeInput ? (
                    <button
                      onClick={() => {
                        setShowAddTypeInput(true);
                        setShowCustomTask(false);
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all bg-surface-hover text-text-secondary hover:text-text hover:bg-surface-hover border border-border border-dashed flex items-center gap-1"
                    >
                      <FiPlus size={12} /> Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        placeholder="New task type..."
                        className="w-32 px-3 py-2 bg-surface-hover border border-border-hover rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:border-border-hover"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTypeName.trim()) {
                            onAddTaskType(newTypeName.trim());
                            setNewTypeName('');
                            setShowAddTypeInput(false);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (newTypeName.trim()) {
                            onAddTaskType(newTypeName.trim());
                            setNewTypeName('');
                            setShowAddTypeInput(false);
                          }
                        }}
                        className="p-2 bg-success-muted text-success rounded-lg hover:bg-success-muted transition-all"
                        aria-label="Confirm add task type"
                      >
                        <FiPlus size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setShowAddTypeInput(false);
                          setNewTypeName('');
                        }}
                        className="p-2 bg-danger-muted text-danger rounded-lg hover:bg-danger-muted transition-all"
                        aria-label="Cancel add task type"
                      >
                        <FiX size={14} />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setShowCustomTask(!showCustomTask);
                      setSelectedTask('');
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      showCustomTask
                        ? 'bg-accent text-white'
                        : 'bg-surface-hover text-text-secondary hover:text-text hover:bg-surface-hover'
                    }`}
                  >
                    One-off
                  </button>
                </div>
                {showCustomTask && (
                  <motion.input
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    type="text"
                    value={customTaskInput}
                    onChange={(e) => setCustomTaskInput(e.target.value)}
                    placeholder="Enter one-off task name..."
                    className="mt-3 w-full px-4 py-2.5 bg-surface-hover border border-border-hover rounded-xl text-text placeholder-text-muted text-sm focus:outline-none focus:border-border-hover"
                  />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-text-secondary">Duration</label>
                  <button
                    onClick={() => setShowCustomTime(!showCustomTime)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-surface-hover text-text-secondary hover:text-text hover:bg-surface-hover border border-border-hover"
                  >
                    <FiEdit2 size={12} />
                    {showCustomTime ? 'Use Presets' : 'Custom Time'}
                  </button>
                </div>

                {!showCustomTime ? (
                  <div className="flex flex-wrap gap-2">
                    {PRESET_DURATIONS.map((preset) => {
                      const isActive =
                        Math.floor(timer.totalSeconds / 3600) === preset.hours &&
                        Math.floor((timer.totalSeconds % 3600) / 60) === preset.minutes &&
                        timer.totalSeconds % 60 === preset.seconds;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => applyPreset(preset.hours, preset.minutes, preset.seconds)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            isActive
                              ? 'bg-accent text-white'
                              : 'bg-surface-hover text-text-secondary hover:text-text hover:bg-surface-hover'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-surface-hover rounded-xl p-4 border border-border-hover">
                    <div className="grid grid-cols-3 gap-4">
                      {['Hours', 'Minutes', 'Seconds'].map((unit) => (
                        <div key={unit}>
                          <label className="text-[10px] text-text-muted block mb-1.5">{unit}</label>
                          <input
                            type="number"
                            min="0"
                            max={unit === 'Hours' ? '24' : '59'}
                            value={
                              unit === 'Hours'
                                ? Math.floor(timer.totalSeconds / 3600)
                                : unit === 'Minutes'
                                  ? Math.floor((timer.totalSeconds % 3600) / 60)
                                  : timer.totalSeconds % 60
                            }
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const h = unit === 'Hours' ? val : Math.floor(timer.totalSeconds / 3600);
                              const m = unit === 'Minutes' ? val : Math.floor((timer.totalSeconds % 3600) / 60);
                              const s = unit === 'Seconds' ? val : timer.totalSeconds % 60;
                              timer.setDurationFromParts(
                                unit === 'Hours' ? Math.min(val, 24) : h,
                                unit === 'Minutes' ? Math.min(val, 59) : m,
                                unit === 'Seconds' ? Math.min(val, 59) : s,
                              );
                            }}
                            className="w-full px-3 py-2.5 bg-surface border border-border-hover rounded-xl text-text text-center text-sm focus:outline-none focus:border-border-hover"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-text-muted text-center mt-2">
                      Total: {formatSecondsAsClock(timer.totalSeconds)}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartSession}
                  disabled={!taskName?.trim()}
                  className="w-full py-4 bg-accent text-white font-bold text-lg rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                >
                  <FiPlay size={22} /> Start Session
                </motion.button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8">
            <div className="text-center max-w-2xl mx-auto">
              <div className="text-sm text-text-secondary mb-2">{taskName}</div>
              <div className="text-7xl font-bold text-text font-mono tracking-wider">
                {formatSecondsAsClock(timer.remainingSeconds)}
              </div>

              <ProgressBar value={timer.progress} className="max-w-lg mx-auto mt-6" />

              <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
                {!timer.isRunning ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={timer.start}
                    disabled={timer.remainingSeconds === 0}
                    className="px-8 py-3.5 bg-accent text-white font-bold text-lg rounded-2xl transition-all flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                  >
                    <FiPlay size={20} /> Resume
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={timer.pause}
                    className="px-8 py-3.5 bg-warning-muted text-warning border border-[var(--warning)]/30 font-bold text-lg rounded-2xl hover:bg-warning-muted transition-all flex items-center gap-3"
                  >
                    <FiPause size={20} /> Pause
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={timer.reset}
                  className="p-3.5 bg-surface-hover text-text-secondary hover:text-text rounded-2xl transition-all border border-border"
                  title="Reset"
                >
                  <FiRotateCcw size={20} />
                </motion.button>
                <div className="flex items-center gap-2">
                  {ADD_TIME_OPTIONS.map((opt) => (
                    <motion.button
                      key={opt.label}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAddTime(opt.seconds)}
                      className="px-4 py-3.5 bg-surface-hover text-text-secondary hover:text-accent rounded-2xl transition-all border border-border text-sm font-medium flex items-center gap-1.5"
                      title={`Add ${opt.label}`}
                    >
                      <FiClock size={14} /> {opt.label}
                    </motion.button>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={resetSession}
                  className="p-3.5 bg-danger-muted text-danger hover:bg-danger-muted rounded-2xl transition-all border border-[var(--danger)]/10"
                  title="Cancel Session"
                >
                  <FiX size={20} />
                </motion.button>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-8 max-w-lg mx-auto">
                <div className="bg-surface-hover rounded-xl p-3">
                  <div className="text-xs text-text-secondary">Elapsed</div>
                  <div className="text-sm font-medium text-text">
                    {formatSecondsAsDuration(timer.totalSeconds - timer.remainingSeconds)}
                  </div>
                </div>
                <div className="bg-surface-hover rounded-xl p-3">
                  <div className="text-xs text-text-secondary">Remaining</div>
                  <div className="text-sm font-medium text-text">{formatSecondsAsDuration(timer.remainingSeconds)}</div>
                </div>
                <div className="bg-surface-hover rounded-xl p-3">
                  <div className="text-xs text-text-secondary">Progress</div>
                  <div className="text-sm font-medium text-text">{Math.round(timer.progress)}%</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
});
