'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  count?: number;
}

interface TabNavProps {
  tabs: readonly Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  size?: 'md' | 'sm';
}

export function TabNav({ tabs, activeTab, onTabChange, className = '', size = 'md' }: TabNavProps) {
  const reduced = useReducedMotion();

  const isSm = size === 'sm';

  return (
    <div
      role="tablist"
      aria-label="Section tabs"
      className={`flex items-center bg-surface-hover rounded-xl p-1 border border-border w-fit ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex items-center gap-2 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none ${
              isSm ? 'px-3 h-9 text-[13px]' : 'px-4 h-11'
            } ${isActive ? 'text-text' : 'text-text-secondary hover:text-text'}`}
          >
            {isActive && (
              <motion.span
                layoutId={`segmented-${tabs.map((t) => t.id).join('-')}`}
                className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_10px_rgba(0,0,0,0.06)]"
                transition={{ type: 'tween', duration: reduced ? 0 : 0.22, ease: 'easeInOut' }}
              />
            )}
            <span className="relative z-10 flex items-center">
              <Icon size={isSm ? 14 : 16} />
            </span>
            <span className="relative z-10">{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`relative z-10 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                  isActive ? 'bg-text/10 text-text' : 'bg-surface text-text-muted'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
