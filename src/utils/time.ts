import { MS_PER_HOUR, MS_PER_MINUTE, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from '@/src/constants';

export interface ParsedDuration {
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
  totalSeconds: number;
}

export const ZERO_DURATION: ParsedDuration = {
  hours: 0,
  minutes: 0,
  seconds: 0,
  totalMinutes: 0,
  totalSeconds: 0,
};

export function parseDuration(duration: string | undefined | null): ParsedDuration {
  if (!duration) return ZERO_DURATION;

  const hoursMatch = duration.match(/(\d+)\s*h/);
  const minutesMatch = duration.match(/(\d+)\s*m/);
  const secondsMatch = duration.match(/(\d+)\s*s/);

  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
  const seconds = secondsMatch ? parseInt(secondsMatch[1], 10) : 0;

  const totalSeconds = hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
  const totalMinutes = hours * SECONDS_PER_MINUTE + minutes + Math.round(seconds / SECONDS_PER_MINUTE);

  return { hours, minutes, seconds, totalMinutes, totalSeconds };
}

export function formatMinutesAsHoursMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h';
  const hours = Math.floor(totalMinutes / SECONDS_PER_MINUTE);
  const minutes = Math.round(totalMinutes % SECONDS_PER_MINUTE);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatMinutes(totalMinutes: number): string {
  return `${Math.max(0, Math.round(totalMinutes))}m`;
}

export function formatSecondsAsDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const mins = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = totalSeconds % SECONDS_PER_MINUTE;

  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function formatSecondsAsClock(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const mins = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = totalSeconds % SECONDS_PER_MINUTE;

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatSecondsAsTimer(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const mins = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = totalSeconds % SECONDS_PER_MINUTE;

  if (hrs > 0) return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export function formatMillisecondsAsDuration(ms: number): string {
  const hours = Math.floor(ms / MS_PER_HOUR);
  const minutes = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function sumSessionMinutes(sessions: ReadonlyArray<{ duration?: string }>): number {
  return sessions.reduce((total, session) => total + parseDuration(session.duration).totalMinutes, 0);
}
