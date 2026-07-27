'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BACKGROUND_IMAGES, BACKGROUND_ROTATION_MS, FALLBACK_BACKGROUND_IMAGE } from '@/src/constants';

interface BackgroundImageProps {
  currentIndex: number;
  onImageError: () => void;
}

export function BackgroundImage({ currentIndex, onImageError }: BackgroundImageProps) {
  const bgImage = BACKGROUND_IMAGES[currentIndex] || BACKGROUND_IMAGES[0];
  const [fallback, setFallback] = useState(false);

  const imageUrl = fallback || BACKGROUND_IMAGES.length === 0 ? FALLBACK_BACKGROUND_IMAGE : bgImage;

  return (
    <motion.div
      key={currentIndex}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url("${imageUrl}")` }}
      onError={() => {
        onImageError();
        setFallback(true);
      }}
    />
  );
}

interface BackgroundManagerProps {
  children: (props: { currentIndex: number; onImageError: () => void }) => React.ReactNode;
}

export function BackgroundManager({ children }: BackgroundManagerProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    BACKGROUND_IMAGES.length > 0 ? Math.floor(Math.random() * BACKGROUND_IMAGES.length) : 0,
  );
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (BACKGROUND_IMAGES.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
      setImageError(false);
    }, BACKGROUND_ROTATION_MS);
    return () => clearInterval(interval);
  }, []);

  return <>{children({ currentIndex, onImageError: () => setImageError(true) })}</>;
}
