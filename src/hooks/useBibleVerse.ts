'use client';

import { useCallback, useEffect, useState } from 'react';
import { BIBLE_API_BASE, FALLBACK_VERSES } from '@/src/constants';
import type { BibleVerse } from '@/src/types';

export interface UseBibleVerseResult {
  verse: BibleVerse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function fetchRemoteVerse(): Promise<BibleVerse> {
  const chapter = Math.floor(Math.random() * 150) + 1;
  const verse = Math.floor(Math.random() * 20) + 1;
  const response = await fetch(`${BIBLE_API_BASE}/${chapter}/verses/${verse}.json`);

  if (!response.ok) {
    throw new Error(`Bible API responded with ${response.status}`);
  }

  const data = await response.json();
  return {
    verse: data.text ?? data.verse ?? pickRandom(FALLBACK_VERSES).verse,
    reference: `Psalm ${chapter}:${verse}`,
  };
}

export function useBibleVerse(): UseBibleVerseResult {
  const [verse, setVerse] = useState<BibleVerse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    fetchRemoteVerse()
      .then((result) => {
        if (!cancelled) setVerse(result);
      })
      .catch(() => {
        if (!cancelled) {
          setVerse(pickRandom(FALLBACK_VERSES));
          setError('Using a fallback verse');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { verse, isLoading, error, refresh };
}
