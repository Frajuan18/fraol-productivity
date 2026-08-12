'use client';

import { FiFilePlus, FiPlay, FiUsers, FiZap } from 'react-icons/fi';
import type { ComponentType } from 'react';
import type { DashboardWidgetProps } from './types';

interface Action {
  key: string;
  label: string;
  description: string;
  tab: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

const ACTIONS: Action[] = [
  { key: 'new-plan', label: 'New Plan', description: 'Create a plan to guide your focus', tab: 'plans', icon: FiFilePlus },
  { key: 'start-focus', label: 'Start Focus', description: 'Begin a focus session now', tab: 'sessions', icon: FiPlay },
  { key: 'continue-plan', label: 'Continue Plan', description: 'Pick up your next task', tab: 'plans', icon: FiZap },
  { key: 'shared', label: 'Shared Space', description: 'Connect with your buddy', tab: 'partner', icon: FiUsers },
];

export default function QuickActionsWidget({ onNavigateTab }: DashboardWidgetProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.key}
            onClick={() => onNavigateTab(action.tab)}
            className="group rounded-[14px] bg-surface-hover/50 border border-border px-3.5 py-3 text-left transition-colors duration-150 hover:bg-surface-hover hover:border-border-hover outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <div className="flex items-center gap-2">
              <Icon size={15} className="text-accent" />
              <span className="text-[13px] font-semibold text-text">{action.label}</span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted leading-snug">{action.description}</p>
          </button>
        );
      })}
    </div>
  );
}