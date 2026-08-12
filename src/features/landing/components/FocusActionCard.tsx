'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FiPlay } from 'react-icons/fi';

interface FocusActionCardProps {
  onStart: () => void;
  shortcut: string;
}

export function FocusActionCard({ onStart, shortcut }: FocusActionCardProps) {
  const reduced = useReducedMotion();

  return (
    <section
      className="rounded-[20px] border border-[rgba(255,255,255,0.1)] bg-[#202229] p-6 shadow-[0_2px_14px_rgba(0,0,0,0.22)] sm:p-8"
      aria-label="Start a focus session"
    >
      <div className="flex flex-col items-center text-center">
        <h2 className="text-[19px] font-semibold tracking-tight text-[#F2F3F5] lg:text-[21px]">Ready to focus?</h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-[#A6ABB5]">
          Start a distraction-free session and stay on task.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <motion.button
          whileHover={reduced ? undefined : { y: -1, filter: 'brightness(1.06)' }}
          whileTap={reduced ? undefined : { scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={onStart}
          className="inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-[#C88A43] px-6 text-base font-semibold text-[#101114] transition-colors hover:bg-[#D79A52] active:bg-[#B97936] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(200,138,67,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#202229] sm:w-auto"
        >
          <FiPlay size={17} className="fill-current" aria-hidden="true" />
          <span>Start Focus Session</span>
          <span className="ml-1 hidden items-center rounded-md bg-black/10 px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-[#101114]/80 sm:inline-flex">
            {shortcut}
          </span>
        </motion.button>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        <span className="h-2 w-2 rounded-full bg-[#3E434C]" aria-hidden="true" />
        <span className="text-xs font-medium text-[#777D87]">Ready to begin</span>
      </div>
    </section>
  );
}
