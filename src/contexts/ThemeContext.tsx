'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY_THEME = 'mywhiteboard-theme';
const STORAGE_KEY_PALETTE = 'mywhiteboard-palette';

type Theme = 'dark' | 'light';
type Palette = 'default' | 'peach-cream' | 'brandy-rose' | 'chalk-beige' | 'neutral' | 'white-beige';

interface PaletteColors {
  accent: string;
  accentHover: string;
  accentMuted: string;
  accentLight: string;
  accentHoverLight: string;
  accentMutedLight: string;
}

export const PALETTES: Record<Palette, PaletteColors> = {
  default: {
    accent: '#FFFFFF',
    accentHover: '#FFFFFF',
    accentMuted: 'rgba(255,255,255,0.16)',
    accentLight: '#B5793B',
    accentHoverLight: '#C98A4E',
    accentMutedLight: 'rgba(181,121,59,0.12)',
  },
  'peach-cream': {
    accent: '#EFE7DA',
    accentHover: '#F5EFE6',
    accentMuted: 'rgba(239,231,218,0.16)',
    accentLight: '#837F78',
    accentHoverLight: '#978F83',
    accentMutedLight: 'rgba(131,127,120,0.12)',
  },
  'brandy-rose': {
    accent: '#B29079',
    accentHover: '#C09F89',
    accentMuted: 'rgba(178,144,121,0.16)',
    accentLight: '#7D6555',
    accentHoverLight: '#8F7561',
    accentMutedLight: 'rgba(125,101,85,0.12)',
  },
  'chalk-beige': {
    accent: '#E1DACA',
    accentHover: '#EBE4D7',
    accentMuted: 'rgba(225,218,202,0.16)',
    accentLight: '#7C786F',
    accentHoverLight: '#8F897D',
    accentMutedLight: 'rgba(124,120,111,0.12)',
  },
  neutral: {
    accent: '#C1B6A4',
    accentHover: '#CFC5B4',
    accentMuted: 'rgba(193,182,164,0.16)',
    accentLight: '#837C70',
    accentHoverLight: '#968D7E',
    accentMutedLight: 'rgba(131,124,112,0.12)',
  },
  'white-beige': {
    accent: '#F6F5EC',
    accentHover: '#FCFCF6',
    accentMuted: 'rgba(246,245,236,0.16)',
    accentLight: '#7B7B76',
    accentHoverLight: '#8F8F88',
    accentMutedLight: 'rgba(123,123,118,0.12)',
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

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, alpha: number): string {
  const c = hexToRgb(hex);
  if (!c) return 'transparent';
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

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

function applyAccentVars(colors: PaletteColors, theme: Theme) {
  const isLight = theme === 'light';
  const accent = isLight ? colors.accentLight : colors.accent;
  const hover = isLight ? colors.accentHoverLight : colors.accentHover;
  const muted = isLight ? colors.accentMutedLight : colors.accentMuted;
  const root = document.documentElement;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-hover', hover);
  root.style.setProperty('--accent-muted', muted);
  root.style.setProperty('--focus-ring', rgba(accent, isLight ? 0.3 : 0.4));
  root.style.setProperty('--accent-contrast', luminance(accent) > 0.5 ? '#1D1D1F' : '#FFFFFF');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(STORAGE_KEY_THEME) as Theme) || 'dark';
  });
  const [palette, setPaletteState] = useState<Palette>(() => {
    if (typeof window === 'undefined') return 'default';
    const saved = localStorage.getItem(STORAGE_KEY_PALETTE);
    return saved && saved in PALETTES ? (saved as Palette) : 'default';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  useEffect(() => {
    applyAccentVars(PALETTES[palette], theme);
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
