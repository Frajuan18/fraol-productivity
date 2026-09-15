'use client';

import { memo, useCallback, useRef, useState } from 'react';
import { FiSend } from 'react-icons/fi';
import { getRepository } from '@/lib/repositories/repository';

/** Minimum gap between "is typing" pings so a burst of keystrokes sends a single frame. */
const TYPING_PING_MS = 1200;

interface ChatComposerProps {
  userId: string | null;
  conversationId: string | null;
  sending: boolean;
  placeholder: string;
  onSend: (text: string) => void;
}

/**
 * Owns the draft message locally. Keeping keystrokes out of the partner workspace means
 * typing never re-renders the message list, the section nav or any other section.
 */
function ChatComposer({ userId, conversationId, sending, placeholder, onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const lastTypingRef = useRef(0);

  const handleChange = useCallback(
    (next: string) => {
      setDraft(next);
      if (!userId || !conversationId) return;
      const now = Date.now();
      if (now - lastTypingRef.current > TYPING_PING_MS) {
        lastTypingRef.current = now;
        void getRepository().sendTyping(userId, conversationId);
      }
    },
    [userId, conversationId],
  );

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    lastTypingRef.current = 0;
    setDraft('');
    onSend(text);
  }, [draft, onSend]);

  return (
    <div className="flex items-center gap-2 border-t border-divider pt-3">
      <input
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={sending}
        className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-hover/40 px-3.5 text-[13.5px] text-text placeholder:text-text-faint outline-none focus:border-accent/50 focus:ring-2 focus:ring-focus-ring disabled:opacity-50"
      />
      <button
        type="button"
        disabled={sending || !draft.trim()}
        onClick={submit}
        aria-label="Send message"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 sm:px-4 text-[13px] font-medium text-accent-contrast hover:opacity-90 transition-opacity disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
      >
        <FiSend size={15} />
        <span className="hidden sm:inline">Send</span>
      </button>
    </div>
  );
}

export default memo(ChatComposer);
