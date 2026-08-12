import type { RealtimeServerEvent } from '@/lib/realtime/events';

export interface PartnershipStream {
  close(): void;
}

export interface PartnershipStreamHandlers {
  onEvent?: (event: RealtimeServerEvent) => void;
  /** Fired when EventSource re-establishes the connection after the initial open. */
  onReconnect?: () => void;
}

/**
 * Opens the authenticated SSE stream for a partnership and dispatches decoded frames to
 * the handler. EventSource reconnects automatically; the returned handle closes it.
 */
export function connectPartnershipStream(
  partnershipId: string,
  handlers: PartnershipStreamHandlers,
): PartnershipStream {
  const url = new URL('/api/realtime', window.location.origin);
  url.searchParams.set('partnershipId', partnershipId);
  const source = new EventSource(url.toString());

  source.onmessage = (message: MessageEvent<string>) => {
    if (!handlers.onEvent) return;
    try {
      handlers.onEvent(JSON.parse(message.data) as RealtimeServerEvent);
    } catch {
      // ignore malformed frames
    }
  };

  let openedOnce = false;
  source.onopen = () => {
    if (openedOnce) handlers.onReconnect?.();
    openedOnce = true;
  };

  return {
    close: () => source.close(),
  };
}
