'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FiBookOpen } from 'react-icons/fi';
import { useBibleVerse } from '@/src/hooks/useBibleVerse';
import { LoadingSpinner } from '@/src/components/ui/LoadingSpinner';

export function LandingBibleVerse() {
  const { verse, isLoading } = useBibleVerse();
  const reduced = useReducedMotion();

  return (
    <motion.div
      key={verse?.reference || 'verse'}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : 0.15, ease: 'easeOut' }}
      className="flex w-full flex-col items-center rounded-[20px] border border-[rgba(255,255,255,0.09)] bg-[#1C1E24] px-6 py-7 text-center shadow-[0_2px_14px_rgba(0,0,0,0.22)] sm:px-8"
      aria-live="polite"
      aria-label={verse ? `Verse of the day: ${verse.verse} — ${verse.reference}` : 'Loading verse of the day'}
    >
      <div className="flex items-center gap-2">
        <FiBookOpen size={13} className="text-[#777D88]" aria-hidden="true" />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#777D88]">Verse of the Day</span>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <LoadingSpinner label="Loading verse..." />
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-xl text-[16px] font-medium leading-relaxed text-[#E7E8EB] sm:text-[17px]">
            &ldquo;{verse?.verse}&rdquo;
          </p>
          <p className="mt-2 text-[13px] font-medium text-[#9297A1]">&mdash; {verse?.reference}</p>
        </>
      )}
    </motion.div>
  );
}
