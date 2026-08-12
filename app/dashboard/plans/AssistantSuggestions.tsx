'use client';

import { useMemo, useState } from 'react';
import { FiZap, FiCheck, FiX } from 'react-icons/fi';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { buildRecommendations } from '@/lib/assistant/recommendations';
import type { DraftPatch, PlanDraft, HistorySignals, PlanRecommendation } from '@/lib/assistant/types';

interface AssistantSuggestionsProps {
  signals: HistorySignals | null;
  draft: PlanDraft;
  onApply: (patch: DraftPatch) => void;
}

const CONFIDENCE_DOT: Record<PlanRecommendation['confidence'], string> = {
  high: 'bg-success',
  medium: 'bg-warning',
  low: 'bg-text-muted',
};

const CONFIDENCE_LABEL: Record<PlanRecommendation['confidence'], string> = {
  high: 'Strong match',
  medium: 'Good guess',
  low: 'Rough estimate',
};

/**
 * Inline, user-approved suggestions for the plan creator. Recommendations are derived
 * purely from the user's own history, never applied automatically, and each one can be
 * applied or dismissed independently. Rendering is driven by the current draft so the
 * chips stay in sync while the user edits.
 */
export default function AssistantSuggestions({ signals, draft, onApply }: AssistantSuggestionsProps) {
  const reduced = useReducedMotion();
  const [handled, setHandled] = useState<Record<string, boolean>>({});

  const recommendations = useMemo(() => {
    if (!signals) return [];
    return buildRecommendations({ draft, signals });
  }, [signals, draft]);

  const visible = recommendations.filter((r) => !handled[r.id]);

  if (!signals || visible.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
      className="rounded-[16px] border border-border bg-surface-hover/40 p-3.5"
    >
      <div className="flex items-center gap-2 text-[11px] font-medium text-text-secondary">
        <FiZap size={12} className="text-accent shrink-0" />
        <span>Suggestions from your history</span>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        <AnimatePresence initial={false}>
          {visible.map((rec) => (
            <motion.li
              key={rec.id}
              layout
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }}
              className="flex items-start gap-2.5 rounded-[12px] border border-border bg-surface px-3 py-2"
            >
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${CONFIDENCE_DOT[rec.confidence]}`}
                title={CONFIDENCE_LABEL[rec.confidence]}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
                  <span className="font-medium text-text">{rec.label}</span>
                  <span className="text-text-secondary">{rec.value}</span>
                </div>
                {rec.detail && <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{rec.detail}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {rec.canApply && (
                  <button
                    type="button"
                    onClick={() => {
                      setHandled((prev) => ({ ...prev, [rec.id]: true }));
                      onApply(rec.apply);
                    }}
                    aria-label={`Apply ${rec.label}`}
                    className="inline-flex items-center gap-1 px-2 h-7 rounded-lg text-[11px] font-semibold text-accent bg-accent-muted hover:bg-accent/15 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                  >
                    <FiCheck size={11} /> Apply
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setHandled((prev) => ({ ...prev, [rec.id]: true }))}
                  aria-label={`Dismiss ${rec.label}`}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-focus-ring outline-none"
                >
                  <FiX size={12} />
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}
