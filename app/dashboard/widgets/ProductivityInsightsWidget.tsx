'use client';

import { FiArrowRight, FiClock, FiInfo, FiStar, FiTrendingUp } from 'react-icons/fi';
import type { ComponentType } from 'react';
import type { DashboardWidgetProps } from './types';

const INSIGHT_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  streak: FiStar,
  longest: FiClock,
  trend: FiTrendingUp,
};

export default function ProductivityInsightsWidget({ bundle, onNavigateTab }: DashboardWidgetProps) {
  const { insights, loading } = bundle;

  if (loading) return null;

  if (insights.length === 0) {
    return (
      <div className="flex items-start gap-3 py-1">
        <FiInfo className="mt-0.5 shrink-0 text-text-muted" size={16} />
        <p className="text-[13px] leading-relaxed text-text-muted">
          Insights will appear as you build more focus history.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3.5">
      {insights.map((insight) => {
        const Icon = INSIGHT_ICONS[insight.kind] ?? FiStar;
        return (
          <li key={insight.id} className="group flex items-start gap-3">
            <Icon className="mt-0.5 shrink-0 text-accent" size={15} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-relaxed text-text-secondary">{insight.text}</p>
              <button
                onClick={() => onNavigateTab(insight.tab)}
                className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:text-accent-hover transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
              >
                {insight.action} <FiArrowRight size={12} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
