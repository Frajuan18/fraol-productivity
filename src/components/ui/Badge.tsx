import { memo } from 'react';

interface BadgeProps {
  className?: string;
  children: React.ReactNode;
}

export const Badge = memo(function Badge({ className = '', children }: BadgeProps) {
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${className}`}>{children}</span>;
});
