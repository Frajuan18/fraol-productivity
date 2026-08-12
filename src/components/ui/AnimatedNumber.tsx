'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
  as?: 'span' | 'div' | 'motion.span' | 'motion.div';
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedNumber({ value, duration = 800, suffix = '', className, as = 'span' }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevRef.current;
    const diff = value - startValue;
    if (diff === 0) return;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = startValue + diff * eased;
      setDisplay(Math.round(current));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(value);
        prevRef.current = value;
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const Tag = as === 'motion.span' ? motion.span : as === 'motion.div' ? motion.div : as;

  return (
    <Tag className={className}>
      {display}
      {suffix}
    </Tag>
  );
}
