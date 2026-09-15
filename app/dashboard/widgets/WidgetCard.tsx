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
    <section aria-label={title} className="card-glass h-full flex flex-col rounded-[18px]">
      <header className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={15} className="text-text-secondary shrink-0" />
          <h2 className="text-[13.5px] font-medium tracking-[-0.01em] text-text truncate">{title}</h2>
        </div>
        <FiChevronDown
          size={14}
          className={`text-text-secondary transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
        />
      </header>
      {!collapsed && <div className="flex-1 min-h-0 px-4 pb-4">{children}</div>}
    </section>
  );
}
