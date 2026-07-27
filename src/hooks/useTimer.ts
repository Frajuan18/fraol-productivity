'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_FOCUS_SECONDS, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/src/constants';
import { formatSecondsAsTimer } from '@/src/utils/time';

export interface TimerConfig {
  initialSeconds?: number;
  onComplete?: () => void;
}

export interface UseTimerResult {
  isRunning: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  progress: number;
  display: string;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setDuration: (seconds: number) => void;
  setDurationFromParts: (hours: number, minutes: number, seconds: number) => void;
  addTime: (seconds: number) => void;
}

export function partsToSeconds(hours: number, minutes: number, seconds: number): number {
  return hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
}

export function useTimer(config: TimerConfig = {}): UseTimerResult {
  const { initialSeconds = DEFAULT_FOCUS_SECONDS, onComplete } = config;

  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, remainingSeconds]);

  useEffect(() => {
    if (!isRunning && remainingSeconds === 0 && totalSeconds > 0) {
      onCompleteRef.current?.();
    }
  }, [isRunning, remainingSeconds, totalSeconds]);

  const start = useCallback(() => {
    setRemainingSeconds((prev) => (prev > 0 ? prev : totalSeconds));
    setIsRunning(true);
  }, [totalSeconds]);

  const pause = useCallback(() => setIsRunning(false), []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);
  }, [totalSeconds]);

  const setDuration = useCallback((seconds: number) => {
    setIsRunning(false);
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
  }, []);

  const setDurationFromParts = useCallback(
    (hours: number, minutes: number, seconds: number) => {
      setDuration(partsToSeconds(hours, minutes, seconds));
    },
    [setDuration],
  );

  const addTime = useCallback((seconds: number) => {
    setTotalSeconds((prev) => prev + seconds);
    setRemainingSeconds((prev) => prev + seconds);
  }, []);

  const progress = totalSeconds === 0 ? 0 : ((totalSeconds - remainingSeconds) / totalSeconds) * 100;

  return {
    isRunning,
    totalSeconds,
    remainingSeconds,
    progress,
    display: formatSecondsAsTimer(remainingSeconds),
    start,
    pause,
    reset,
    setDuration,
    setDurationFromParts,
    addTime,
  };
}
