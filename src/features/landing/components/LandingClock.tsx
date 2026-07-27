'use client';

import { motion } from 'framer-motion';
import { useClock } from '@/src/hooks/useClock';

export function LandingClock() {
  const { time, date } = useClock();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center"
      aria-live="polite"
      aria-label={`Current time: ${time}, ${date}`}
    >
      <div className="text-5xl lg:text-7xl font-light text-text tracking-wider" role="timer">
        {time}
      </div>
      <div className="text-sm text-text-muted mt-1">{date}</div>
    </motion.div>
  );
}
