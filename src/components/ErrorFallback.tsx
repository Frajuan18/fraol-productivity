'use client';

import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

interface ErrorFallbackProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center bg-page text-text p-8">
      <div className="text-center max-w-md">
        <FiAlertTriangle className="mx-auto text-4xl text-warning mb-4" />
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-text-secondary text-sm mb-4">{error?.message || 'An unexpected error occurred'}</p>
        {resetErrorBoundary && (
          <button
            onClick={resetErrorBoundary}
            className="px-6 py-2.5 bg-surface-hover hover:bg-surface-hover rounded-xl text-sm font-medium transition-all flex items-center gap-2 mx-auto"
          >
            <FiRefreshCw size={16} /> Try Again
          </button>
        )}
      </div>
    </div>
  );
}
