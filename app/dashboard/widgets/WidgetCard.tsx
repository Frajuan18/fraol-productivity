'use client';

import type { ComponentType, ReactNode } from 'react';
import { FiChevronDown } from 'react-icons/fi';

export interface WidgetCardProps {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  collapsed: boolean;
  children: ReactNode;
}

export default function WidgetCard({ title, icon: Icon, collapsed, children }: WidgetCardProps) {
  return (
    <section aria-label={title} className="card-glass h-full flex flex-col rounded-[22px]">
      <header className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={17} className="text-text-secondary shrink-0" />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-text truncate">{title}</h2>
        </div>
        <FiChevronDown
          size={16}
          className={`text-text-secondary transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
        />
      </header>
      {!collapsed && <div className="flex-1 min-h-0 px-5 pb-5">{children}</div>}
    </section>
  );
}
