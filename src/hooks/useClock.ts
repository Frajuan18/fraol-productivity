'use client';

import { useEffect, useState } from 'react';
import { formatClockTimeWithSeconds, formatLongDate } from '@/src/utils/date';

export interface ClockState {
  time: string;
  date: string;
  now: Date;
}

export function useClock(): ClockState {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    time: formatClockTimeWithSeconds(now),
    date: formatLongDate(now),
    now,
  };
}
