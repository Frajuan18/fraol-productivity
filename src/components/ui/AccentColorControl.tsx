'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';
import { PALETTES, useTheme } from '@/src/contexts/ThemeContext';

const PRESET_META = [
  { id: 'default', label: 'Default' },
  { id: 'peach-cream', label: 'Peach Cream' },
  { id: 'brandy-rose', label: 'Brandy Rose' },
  { id: 'chalk-beige', label: 'Chalk Beige' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'white-beige', label: 'White Beige' },
] as const;

const APPLE_EASE: [number, number, number, number] = [0.2, 0, 0, 1];

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return 0;
  const n = parseInt(h, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastColor(hex: string): string {
  return luminance(hex) > 0.5 ? '#1D1D1F' : '#FFFFFF';
}

function SwatchButton({
  label,
  color,
  selected,
  onSelect,
  ariaLabel,
}: {
  label: string;
  color: string;
  selected: boolean;
  onSelect: () => void;
  ariaLabel: string;
}) {
  const checkColor = contrastColor(color);
  return (
    <span
      className={`inline-flex rounded-[12px] ${selected ? 'ring-2 ring-offset-[3px]' : ''}`}
      style={
        selected
          ? ({ '--tw-ring-color': color, '--tw-ring-offset-color': 'var(--surface)' } as React.CSSProperties)
          : undefined
      }
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={ariaLabel}
        className="group relative flex h-12 w-12 items-center justify-center rounded-[12px] border border-black/10 outline-none transition-[transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] hover:scale-[1.06] hover:shadow-[var(--card-shadow-hover)] active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:transform-none dark:border-white/15"
        style={{ backgroundColor: color }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_2px_rgba(0,0,0,0.12)]"
        />
        <FiCheck
          aria-hidden="true"
          size={18}
          strokeWidth={3}
          className={`relative transition-all duration-[180ms] ease-[cubic-bezier(0.2,0,0,1)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)] ${
            selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}
          style={{ color: checkColor }}
        />
        <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-raised px-2 py-1 text-[10px] font-medium text-text opacity-0 shadow-[var(--card-shadow)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
          {label}
        </span>
      </button>
    </span>
  );
}

export default function AccentColorControl() {
  const reduced = useReducedMotion();
  const { theme, palette, setPalette } = useTheme();
  const [flash, setFlash] = useState<{ id: number } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const flashIdRef = useRef(0);

  function triggerFlash() {
    flashIdRef.current += 1;
    setFlash({ id: flashIdRef.current });
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1600);
  }

  useEffect(() => {
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  function selectPreset(id: (typeof PRESET_META)[number]['id']) {
    setPalette(id);
    triggerFlash();
  }

  const currentColor = theme === 'light' ? PALETTES[palette].accentLight : PALETTES[palette].accent;
  const selectedLabel = PRESET_META.find((p) => p.id === palette)?.label || 'Default';

  return (
    <div>
      <div className="text-[13px] font-medium text-text">Accent Color</div>
      <div className="text-xs text-text-muted mt-0.5">Choose a color that personalizes your workspace.</div>

      <div className="mt-4 grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-3 md:grid-cols-6">
        {PRESET_META.map((opt) => {
          const p = PALETTES[opt.id];
          const color = theme === 'light' ? p.accentLight : p.accent;
          const selected = palette === opt.id;
          return (
            <SwatchButton
              key={opt.id}
              label={opt.label}
              color={color}
              selected={selected}
              onSelect={() => selectPreset(opt.id)}
              ariaLabel={selected ? `Selected: ${opt.label} accent color` : `Select ${opt.label} accent color`}
            />
          );
        })}
      </div>

      <div className="mt-3 min-h-[18px] text-xs" role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {flash ? (
            <motion.span
              key={`flash-${flash.id}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.18, ease: APPLE_EASE }}
              className="inline-flex items-center gap-1.5 text-success"
            >
              <FiCheck size={12} className="shrink-0" />
              Accent color updated
            </motion.span>
          ) : (
            <motion.span
              key="caption"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.18 }}
              className="inline-flex items-center gap-1.5 text-text-muted"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentColor }} />
              Selected: {selectedLabel} accent color
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
