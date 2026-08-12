import { getRequestUserId } from '@/lib/auth/session';
import { createMongoDbRepository } from '@/lib/repositories/mongodb/MongoDbProductivityRepository';
import { broadcastPartnership, connectClient, getActiveSession, setActiveSession } from '@/lib/realtime/hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

function sse(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Server-Sent Events stream for a partnership. The partnership is resolved from the
 * authenticated session (the query string is never trusted). The server is the source of
 * truth for time: a 1s heartbeat carries an authoritative `at` timestamp plus the active
 * shared-focus session so both dashboards stay within ~1s of each other.
 */
export async function GET(request: Request): Promise<Response> {
  const userId = await getRequestUserId(request);
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const repository = createMongoDbRepository();
  if (!repository) {
    return new Response('Realtime unavailable: MongoDB is not configured.', { status: 503 });
  }

  const partner = await repository.getPartner(userId);
  if (!partner) {
    return new Response('No configured partnership.', { status: 404 });
  }
  const partnershipId = partner.partnership.id;

  const active = await repository.getActiveSharedFocus(userId);
  if (active) setActiveSession(partnershipId, active);

  const status = active?.status === 'running' ? 'focusing' : 'online';
  const maskedPresence = await repository.getMaskedPresence(userId, status);

  let disconnectFn: (() => void) | null = null;
  let cleanedUp = false;

  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    disconnectFn?.();
    disconnectFn = null;
    void repository.setUserStatus(userId, 'offline');
    void repository.getMaskedPresence(userId, 'offline').then((masked) => {
      broadcastPartnership(partnershipId, {
        type: 'presence',
        userId,
        status: masked.status,
        lastSeenAt: masked.lastSeenAt,
      });
    });
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const send = (payload: Record<string, unknown>): void => {
        if (cleanedUp) return;
        try {
          controller.enqueue(sse(payload));
        } catch {
          // stream closed
        }
      };

      disconnectFn = connectClient(partnershipId, { userId, send });

      void repository.setUserStatus(userId, status);
      send({ type: 'connected', partnershipId, at: new Date().toISOString() });
      broadcastPartnership(partnershipId, {
        type: 'presence',
        userId,
        status: maskedPresence.status,
        lastSeenAt: maskedPresence.lastSeenAt,
      });

      heartbeat = setInterval(() => {
        const session = getActiveSession(partnershipId);
        send({ type: 'heartbeat', at: new Date().toISOString(), session });
      }, 1000);

      request.signal.addEventListener(
        'abort',
        () => {
          if (heartbeat) clearInterval(heartbeat);
          cleanup();
        },
        { once: true },
      );
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
