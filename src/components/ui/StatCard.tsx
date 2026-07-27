'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

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
      className="bg-surface rounded-2xl p-4 border border-border"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-text-secondary text-xs uppercase tracking-wider">{label}</span>
        {icon && <span className="text-text-secondary">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold text-text mt-1 ${valueClassName ?? ''}`}>{value}</div>
      {trend && (
        <div className={`text-xs mt-1 flex items-center gap-1 ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
          <span>{trend.value}</span>
        </div>
      )}
    </motion.div>
  );
});
