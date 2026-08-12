'use client';

import type { ComponentType, ReactNode } from 'react';
import { FiChevronDown, FiChevronUp, FiEyeOff, FiMaximize, FiMinimize } from 'react-icons/fi';
import type { MoveDirection } from '@/lib/dashboard/layout';
import type { WidgetSize } from '@/lib/dashboard/types';

export interface WidgetCardProps {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  collapsed: boolean;
  editing: boolean;
  resizable: boolean;
  size: WidgetSize;
  loading?: boolean;
  onToggleCollapse: () => void;
  onToggleSize: () => void;
  onHide: () => void;
  onMove: (direction: MoveDirection) => void;
  onMoveEdge: (edge: 'start' | 'end') => void;
  dragHandle?: ReactNode;
  children: ReactNode;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
    >
      {children}
    </button>
  );
}

/**
 * Standard card shell every widget renders inside. The header carries the title, an optional
 * drag grip (provided by the grid while editing) and the accessibility controls: collapse,
 * move up/down/edge, resize (resizable widgets) and hide. In non-edit mode only the collapse
 * chevron is visible, keeping the dashboard calm.
 */
export default function WidgetCard({
  title,
  icon: Icon,
  collapsed,
  editing,
  resizable,
  size,
  loading,
  onToggleCollapse,
  onToggleSize,
  onHide,
  onMove,
  onMoveEdge,
  dragHandle,
  children,
}: WidgetCardProps) {
  const controlsVisible = editing;
  return (
    <section
      aria-label={title}
      className={`card-glass h-full flex flex-col rounded-[22px] ${editing ? 'ring-1 ring-focus-ring/60' : ''}`}
    >
      <header className="flex items-center gap-2 px-5 pt-4 pb-3">
        {dragHandle}
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon size={17} className="text-text-secondary shrink-0" />
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-text truncate">{title}</h2>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {controlsVisible && (
            <div className="flex items-center gap-0.5" role="group" aria-label={`${title} controls`}>
              <IconButton label="Move to top" onClick={() => onMoveEdge('start')}>
                <FiChevronUp size={15} className="-mb-1" />
              </IconButton>
              <IconButton label="Move up" onClick={() => onMove('up')}>
                <FiChevronUp size={15} />
              </IconButton>
              <IconButton label="Move down" onClick={() => onMove('down')}>
                <FiChevronDown size={15} />
              </IconButton>
              <IconButton label="Move to bottom" onClick={() => onMoveEdge('end')}>
                <FiChevronDown size={15} className="-mt-1" />
              </IconButton>
              {resizable && (
                <IconButton label={size === 'large' ? 'Make smaller' : 'Make larger'} onClick={onToggleSize}>
                  {size === 'large' ? <FiMinimize size={15} /> : <FiMaximize size={15} />}
                </IconButton>
              )}
              <IconButton label="Hide widget" onClick={onHide}>
                <FiEyeOff size={15} />
              </IconButton>
            </div>
          )}
          <IconButton label={collapsed ? `Expand ${title}` : `Collapse ${title}`} onClick={onToggleCollapse}>
            <FiChevronDown size={16} className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
          </IconButton>
        </div>
      </header>

      {!collapsed && (
        <div className="flex-1 min-h-0 px-5 pb-5">
          {loading ? (
            <div className="space-y-3 animate-pulse" aria-hidden="true">
              <div className="h-3 w-24 rounded bg-surface-hover" />
              <div className="h-7 w-40 rounded-lg bg-surface-hover" />
              <div className="h-3 w-32 rounded bg-surface-hover" />
              <div className="h-16 rounded-xl bg-surface-hover" />
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}
