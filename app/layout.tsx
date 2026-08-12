import type { Metadata } from 'next';
import { Inter, Bebas_Neue } from 'next/font/google';
import './globals.css';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { ThemeProvider } from '@/src/contexts/ThemeContext';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const bebasNeue = Bebas_Neue({
  variable: '--font-bebas',
  weight: '400',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'MyWhiteboard — Focus & Productivity',
  description: 'A personal productivity dashboard with focus sessions, plans, streaks, and performance tracking.',
};

const themeScript = `
  (function() {
    var theme = localStorage.getItem('mywhiteboard-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    var palette = localStorage.getItem('mywhiteboard-palette') || 'default';
    var palettes = {
      default:{d:'#FFFFFF',dh:'#FFFFFF',dm:'rgba(255,255,255,0.16)',l:'#B5793B',lh:'#C98A4E',lm:'rgba(181,121,59,0.12)'},
      'peach-cream':{d:'#EFE7DA',dh:'#F5EFE6',dm:'rgba(239,231,218,0.16)',l:'#837F78',lh:'#978F83',lm:'rgba(131,127,120,0.12)'},
      'brandy-rose':{d:'#B29079',dh:'#C09F89',dm:'rgba(178,144,121,0.16)',l:'#7D6555',lh:'#8F7561',lm:'rgba(125,101,85,0.12)'},
      'chalk-beige':{d:'#E1DACA',dh:'#EBE4D7',dm:'rgba(225,218,202,0.16)',l:'#7C786F',lh:'#8F897D',lm:'rgba(124,120,111,0.12)'},
      neutral:{d:'#C1B6A4',dh:'#CFC5B4',dm:'rgba(193,182,164,0.16)',l:'#837C70',lh:'#968D7E',lm:'rgba(131,124,112,0.12)'},
      'white-beige':{d:'#F6F5EC',dh:'#FCFCF6',dm:'rgba(246,245,236,0.16)',l:'#7B7B76',lh:'#8F8F88',lm:'rgba(123,123,118,0.12)'}
    };
    if (palettes[palette]) {
      var p = palettes[palette];
      var c = theme === 'light' ? {a:p.l,ah:p.lh,am:p.lm} : {a:p.d,ah:p.dh,am:p.dm};
      var lin = function(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      var r = parseInt(c.a.slice(1,3), 16) / 255;
      var g = parseInt(c.a.slice(3,5), 16) / 255;
      var b = parseInt(c.a.slice(5,7), 16) / 255;
      var lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      document.documentElement.style.setProperty('--accent', c.a);
      document.documentElement.style.setProperty('--accent-hover', c.ah);
      document.documentElement.style.setProperty('--accent-muted', c.am);
      document.documentElement.style.setProperty('--focus-ring', c.a);
      document.documentElement.style.setProperty('--accent-contrast', lum > 0.5 ? '#1D1D1F' : '#FFFFFF');
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${bebasNeue.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-page text-text">
        <ErrorBoundary>
          <ThemeProvider>{children}</ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
