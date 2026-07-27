'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FiPlay, FiZap } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { BackgroundImage, BackgroundManager } from './components/BackgroundImage';
import { LandingClock } from './components/LandingClock';
import { LandingBibleVerse } from './components/LandingBibleVerse';
import { LandingStats } from './components/LandingStats';
import { LoginModal } from './components/LoginModal';
export function LandingPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <main className="min-h-screen relative overflow-hidden">
      <BackgroundManager>
        {({ currentIndex, onImageError }) => (
          <>
            <BackgroundImage currentIndex={currentIndex} onImageError={onImageError} />
            <div className="absolute inset-0 bg-overlay backdrop-blur-md" />

            <div className="relative z-10 p-6 lg:p-10 min-h-screen flex flex-col">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center justify-between mb-6"
              >
                <div className="flex items-center gap-3">
                  {/* Users: Replace /images/profile.png with your own profile photo. Add your image to the public/images/ folder. */}
                  <div className="w-10 h-10 rounded-full bg-surface-hover border border-border-hover overflow-hidden flex items-center justify-center">
                    <Image src="/images/profile.png" alt="Profile" width={40} height={40} className="object-cover" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text">Fraol</div>
                    <div className="text-[10px] text-text-muted">Focus Mode</div>
                  </div>
                </div>
              </motion.div>

              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <LandingClock />
                <LandingBibleVerse />
              </div>

              <LandingStats />

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="mt-4 flex justify-center"
              >
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="w-full max-w-xs px-6 py-3 bg-surface-hover backdrop-blur-md hover:bg-surface-hover border border-border-hover rounded-xl text-text font-medium transition-all flex items-center justify-center gap-3"
                >
                  <FiPlay className="text-text-secondary" size={16} />
                  <span>Start Focus Session</span>
                  <FiZap className="text-text-muted" size={14} />
                </button>
              </motion.div>
            </div>
          </>
        )}
      </BackgroundManager>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </main>
  );
}
