interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function LoadingSpinner({ size = 'sm', label }: LoadingSpinnerProps) {
  const sizeClass = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-3">
      <div className={`${sizeClass} border-2 border-border border-t-accent rounded-full animate-spin`} />
      {label && <span className="text-text-muted text-xs">{label}</span>}
    </div>
  );
}
