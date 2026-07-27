import { describe, it, expect } from 'vitest';
import {
  parseDuration,
  formatMinutesAsHoursMinutes,
  formatSecondsAsDuration,
  formatSecondsAsClock,
  formatSecondsAsTimer,
  formatMillisecondsAsDuration,
  sumSessionMinutes,
} from '@/src/utils/time';

describe('parseDuration', () => {
  it('parses "1h 25m 30s"', () => {
    const result = parseDuration('1h 25m 30s');
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(25);
    expect(result.seconds).toBe(30);
    expect(result.totalMinutes).toBe(86);
    expect(result.totalSeconds).toBe(5130);
  });

  it('parses "30m" only', () => {
    const result = parseDuration('30m');
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(30);
    expect(result.totalSeconds).toBe(1800);
  });

  it('parses "45s" only', () => {
    const result = parseDuration('45s');
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(45);
    expect(result.totalSeconds).toBe(45);
  });

  it('returns zero for null', () => {
    const result = parseDuration(null);
    expect(result.totalSeconds).toBe(0);
  });

  it('returns zero for undefined', () => {
    const result = parseDuration(undefined);
    expect(result.totalSeconds).toBe(0);
  });

  it('returns zero for empty string', () => {
    const result = parseDuration('');
    expect(result.totalSeconds).toBe(0);
  });
});

describe('formatMinutesAsHoursMinutes', () => {
  it('formats 90 as "1h 30m"', () => {
    expect(formatMinutesAsHoursMinutes(90)).toBe('1h 30m');
  });

  it('formats 45 as "45m"', () => {
    expect(formatMinutesAsHoursMinutes(45)).toBe('45m');
  });

  it('formats 0 as "0h"', () => {
    expect(formatMinutesAsHoursMinutes(0)).toBe('0h');
  });
});

describe('formatSecondsAsDuration', () => {
  it('formats 3661 as "1h 1m"', () => {
    expect(formatSecondsAsDuration(3661)).toBe('1h 1m');
  });

  it('formats 125 as "2m 5s"', () => {
    expect(formatSecondsAsDuration(125)).toBe('2m 5s');
  });

  it('formats 30 as "30s"', () => {
    expect(formatSecondsAsDuration(30)).toBe('30s');
  });
});

describe('formatSecondsAsClock', () => {
  it('formats 3661 as "1h 01m 01s"', () => {
    expect(formatSecondsAsClock(3661)).toBe('1h 01m 01s');
  });

  it('formats 125 as "02:05"', () => {
    expect(formatSecondsAsClock(125)).toBe('02:05');
  });
});

describe('formatSecondsAsTimer', () => {
  it('formats 3661 as "1h 01m"', () => {
    expect(formatSecondsAsTimer(3661)).toBe('1h 01m');
  });

  it('formats 125 as "2m 05s"', () => {
    expect(formatSecondsAsTimer(125)).toBe('2m 05s');
  });
});

describe('formatMillisecondsAsDuration', () => {
  it('formats 5400000 as "1h 30m"', () => {
    expect(formatMillisecondsAsDuration(5400000)).toBe('1h 30m');
  });

  it('formats 60000 as "1m"', () => {
    expect(formatMillisecondsAsDuration(60000)).toBe('1m');
  });
});

describe('sumSessionMinutes', () => {
  it('sums durations across sessions', () => {
    const sessions = [{ duration: '1h 30m' }, { duration: '45m' }, { duration: '30s' }];
    expect(sumSessionMinutes(sessions)).toBe(136);
  });

  it('returns 0 for empty array', () => {
    expect(sumSessionMinutes([])).toBe(0);
  });
});
