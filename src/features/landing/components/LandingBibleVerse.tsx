'use client';

import { motion } from 'framer-motion';
import { FiBookOpen } from 'react-icons/fi';
import { useBibleVerse } from '@/src/hooks/useBibleVerse';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';

export function LandingBibleVerse() {
  const { verse, isLoading, error } = useBibleVerse();

  return (
    <motion.div
      key={verse?.reference || 'verse'}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="max-w-md w-full text-center bg-surface/60 backdrop-blur-md rounded-xl p-4 border border-border"
      aria-live="polite"
      aria-label={verse ? `Verse of the day: ${verse.verse} — ${verse.reference}` : 'Loading verse of the day'}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-2">
          <LoadingSpinner label="Loading verse..." />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-2 mb-2">
            <FiBookOpen className="text-text-muted" size={12} />
            <span className="text-text-muted text-[8px] uppercase tracking-wider">Verse of the Day</span>
          </div>
          {/* Users: To remove the Bible verse feature, delete this entire LandingBibleVerse component and remove its usage from LandingPage.tsx */}
          <p className="text-sm text-text-secondary font-light italic leading-relaxed">&ldquo;{verse?.verse}&rdquo;</p>
          <p className="text-[10px] text-text-muted mt-2 font-medium">&mdash; {verse?.reference}</p>
        </>
      )}
    </motion.div>
  );
}
