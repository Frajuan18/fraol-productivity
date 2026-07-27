'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY_THEME = 'mywhiteboard-theme';
const STORAGE_KEY_PALETTE = 'mywhiteboard-palette';

type Theme = 'dark' | 'light';
type Palette = 'navy' | 'teal' | 'orange' | 'amber' | 'charcoal';

interface PaletteColors {
  accent: string;
  accentHover: string;
  accentMuted: string;
  accentLight: string;
  accentHoverLight: string;
  accentMutedLight: string;
}

export const PALETTES: Record<Palette, PaletteColors> = {
  navy: {
    accent: '#5B7B9A',
    accentHover: '#6F8FAE',
    accentMuted: 'rgba(91,123,154,0.12)',
    accentLight: '#3D6B8F',
    accentHoverLight: '#4F7FA3',
    accentMutedLight: 'rgba(61,107,143,0.08)',
  },
  teal: {
    accent: '#5A9E9E',
    accentHover: '#6EB2B2',
    accentMuted: 'rgba(90,158,158,0.12)',
    accentLight: '#2D7D7D',
    accentHoverLight: '#3F9191',
    accentMutedLight: 'rgba(45,125,125,0.08)',
  },
  orange: {
    accent: '#C4884A',
    accentHover: '#D89C5E',
    accentMuted: 'rgba(196,136,74,0.12)',
    accentLight: '#B8753A',
    accentHoverLight: '#CC894E',
    accentMutedLight: 'rgba(184,117,58,0.08)',
  },
  amber: {
    accent: '#C4A44A',
    accentHover: '#D8B85E',
    accentMuted: 'rgba(196,164,74,0.12)',
    accentLight: '#B8942A',
    accentHoverLight: '#CCA83E',
    accentMutedLight: 'rgba(184,148,42,0.08)',
  },
  charcoal: {
    accent: '#8A8A8A',
    accentHover: '#9E9E9E',
    accentMuted: 'rgba(138,138,138,0.12)',
    accentLight: '#5A5A5A',
    accentHoverLight: '#6E6E6E',
    accentMutedLight: 'rgba(90,90,90,0.08)',
  },
};

interface ThemeContextValue {
  theme: Theme;
  palette: Palette;
  toggleTheme: () => void;
  setPalette: (p: Palette) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function applyPalette(palette: Palette, theme: Theme) {
  const p = PALETTES[palette];
  const target =
    theme === 'light'
      ? { accent: p.accentLight, accentHover: p.accentHoverLight, accentMuted: p.accentMutedLight }
      : { accent: p.accent, accentHover: p.accentHover, accentMuted: p.accentMuted };
  document.documentElement.style.setProperty('--accent', target.accent);
  document.documentElement.style.setProperty('--accent-hover', target.accentHover);
  document.documentElement.style.setProperty('--accent-muted', target.accentMuted);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(STORAGE_KEY_THEME) as Theme) || 'dark';
  });
  const [palette, setPaletteState] = useState<Palette>(() => {
    if (typeof window === 'undefined') return 'navy';
    const saved = localStorage.getItem(STORAGE_KEY_PALETTE);
    return saved && saved in PALETTES ? (saved as Palette) : 'navy';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  useEffect(() => {
    applyPalette(palette, theme);
    localStorage.setItem(STORAGE_KEY_PALETTE, palette);
  }, [palette, theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setPalette = useCallback((p: Palette) => {
    setPaletteState(p);
  }, []);

  return <ThemeContext.Provider value={{ theme, palette, toggleTheme, setPalette }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
