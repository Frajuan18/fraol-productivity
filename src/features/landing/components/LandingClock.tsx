'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useClock } from '@/src/hooks/useClock';
import { formatClockTime, formatLongDate } from '@/src/utils/date';

export function LandingClock() {
  const { now } = useClock();
  const reduced = useReducedMotion();
  const time = formatClockTime(now);
  const date = formatLongDate(now);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.7, ease: 'easeOut' }}
      className="flex flex-col items-center py-6 text-center sm:py-8"
    >
      <div
        role="timer"
        aria-live="off"
        aria-label={`Current time: ${time}, ${date}`}
        className="text-[72px] leading-none font-light tracking-tight text-[#F4F4F6] tabular-nums sm:text-[80px] lg:text-[84px]"
      >
        {time}
      </div>
      <div className="mt-2 text-[15px] font-medium text-[#9EA3AD]">{date}</div>
    </motion.div>
  );
}
