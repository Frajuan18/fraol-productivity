'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { AnimatedNumber } from './AnimatedNumber';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; isPositive: boolean };
  delay?: number;
  valueClassName?: string;
}

export const StatCard = memo(function StatCard({
  label,
  value,
  icon,
  trend,
  delay = 0,
  valueClassName,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="card-glass rounded-[20px] p-5 hover:-translate-y-0.5 transition-transform duration-500 relative overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-1">
        {icon && <span className="text-text-secondary shrink-0">{icon}</span>}
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
      <div className={`text-2xl font-bold tracking-tight text-text ${valueClassName ?? ''}`}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      {trend && (
        <div className={`text-xs mt-1 flex items-center gap-1 ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
          <span>{trend.value}</span>
        </div>
      )}
    </motion.div>
  );
});
