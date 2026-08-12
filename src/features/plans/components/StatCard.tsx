'use client';

import { motion } from 'framer-motion';

interface PlanStatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  delay?: number;
  color?: string;
}

export function PlanStatCard({ label, value, icon, delay = 0 }: PlanStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-surface rounded-2xl p-4 border border-border"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-text mt-1">{value}</div>
    </motion.div>
  );
}
