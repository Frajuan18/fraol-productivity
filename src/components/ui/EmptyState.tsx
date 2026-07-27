import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="text-center py-8">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-sm text-text-secondary">{title}</p>
      {description && <p className="text-xs text-text-muted mt-1">{description}</p>}
    </div>
  );
}
