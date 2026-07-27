import type { Metadata } from 'next';
import { Sora } from 'next/font/google';
import './globals.css';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { ThemeProvider } from '@/src/contexts/ThemeContext';

const sora = Sora({
  variable: '--font-sora',
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
    var palette = localStorage.getItem('mywhiteboard-palette') || 'navy';
    var palettes = {
      navy:{d:'#5B7B9A',dh:'#6F8FAE',dm:'rgba(91,123,154,0.12)',l:'#3D6B8F',lh:'#4F7FA3',lm:'rgba(61,107,143,0.08)'},
      teal:{d:'#5A9E9E',dh:'#6EB2B2',dm:'rgba(90,158,158,0.12)',l:'#2D7D7D',lh:'#3F9191',lm:'rgba(45,125,125,0.08)'},
      orange:{d:'#C4884A',dh:'#D89C5E',dm:'rgba(196,136,74,0.12)',l:'#B8753A',lh:'#CC894E',lm:'rgba(184,117,58,0.08)'},
      amber:{d:'#C4A44A',dh:'#D8B85E',dm:'rgba(196,164,74,0.12)',l:'#B8942A',lh:'#CCA83E',lm:'rgba(184,148,42,0.08)'},
      charcoal:{d:'#8A8A8A',dh:'#9E9E9E',dm:'rgba(138,138,138,0.12)',l:'#5A5A5A',lh:'#6E6E6E',lm:'rgba(90,90,90,0.08)'}
    };
    if (palettes[palette]) {
      var p = palettes[palette];
      var c = theme === 'light' ? {a:p.l,ah:p.lh,am:p.lm} : {a:p.d,ah:p.dh,am:p.dm};
      document.documentElement.style.setProperty('--accent', c.a);
      document.documentElement.style.setProperty('--accent-hover', c.ah);
      document.documentElement.style.setProperty('--accent-muted', c.am);
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} h-full antialiased`} suppressHydrationWarning>
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
