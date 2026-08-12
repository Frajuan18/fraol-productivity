'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BackgroundImage, BackgroundManager } from './components/BackgroundImage';
import { LandingClock } from './components/LandingClock';
import { LandingBibleVerse } from './components/LandingBibleVerse';
import { LandingStats } from './components/LandingStats';
import { FocusActionCard } from './components/FocusActionCard';
import { LoginModal } from './components/LoginModal';

export function LandingPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isMac] = useState(() => /Mac|iPod|iPhone|iPad/i.test(navigator.platform || ''));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowLoginModal(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shortcut = isMac ? '\u2318 Enter' : 'Ctrl \u21B5';

  return (
    <main className="focus-screen relative min-h-screen bg-page text-text">
      <BackgroundManager>
        {({ currentIndex, onImageError }) => (
          <>
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 scale-[1.08] blur-[16px] saturate-[0.3] brightness-[0.6] contrast-[0.95]">
                <BackgroundImage currentIndex={currentIndex} onImageError={onImageError} />
              </div>
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(16,17,20,0.84) 0%, rgba(16,17,20,0.72) 50%, rgba(16,17,20,0.88) 100%)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{ boxShadow: 'inset 0 0 220px 60px rgba(0,0,0,0.5)' }}
                aria-hidden="true"
              />
            </div>

            <div className="relative z-10 flex min-h-screen flex-col px-5 sm:px-8 lg:px-12">
              <header className="flex items-center gap-3 pt-8">
                <div className="flex items-center gap-3 rounded-full border border-[rgba(255,255,255,0.09)] bg-[#1C1E24]/70 py-1.5 pl-1.5 pr-4 backdrop-blur-md">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[rgba(255,255,255,0.12)]">
                    <Image src="/images/profile.png" alt="Profile" width={36} height={36} className="object-cover" />
                  </div>
                  <div className="text-left leading-tight">
                    <div className="text-[15px] font-semibold text-text">Fraol</div>
                    <div className="text-xs font-normal text-[#8D929C]">Focus Mode</div>
                  </div>
                </div>
              </header>

              <div className="flex flex-1 flex-col items-center justify-center py-10 lg:py-12">
                <div className="w-full max-w-[1120px]">
                  <LandingClock />

                  <div className="mx-auto mt-7 w-full max-w-[680px]">
                    <LandingBibleVerse />
                  </div>

                  <div className="mt-6">
                    <LandingStats />
                  </div>

                  <div className="mx-auto mt-5 w-full max-w-[680px] lg:mt-6">
                    <FocusActionCard onStart={() => setShowLoginModal(true)} shortcut={shortcut} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </BackgroundManager>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </main>
  );
}
