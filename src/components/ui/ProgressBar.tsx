'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}

export function ProgressBar({ value, max = 100, className = '', barClassName = '' }: ProgressBarProps) {
  const percentage = max === 0 ? 0 : Math.min((value / max) * 100, 100);
  return (
    <div className={`w-full h-2 bg-surface-hover rounded-full overflow-hidden ${className}`}>
      <motion.div
        className={`h-full rounded-full ${barClassName || 'bg-accent'}`}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
}
