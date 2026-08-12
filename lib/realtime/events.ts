import type { Message, SharedFocusSession, UserStatus } from '@/src/types/collaboration';

/**
 * Server → client event contract for the SSE partnership stream (GET /api/realtime).
 * The server is the source of truth for time: heartbeats carry an authoritative
 * `at` timestamp and the current active shared-focus session so both dashboards keep
 * ~1s parity without trusting the client clock.
 */
export type RealtimeServerEvent =
  | { type: 'connected'; partnershipId: string; at: string }
  | { type: 'heartbeat'; at: string; session: SharedFocusSession | null }
  | { type: 'focus.state'; session: SharedFocusSession; at: string }
  | { type: 'presence'; userId: string; status: UserStatus; lastSeenAt: string }
  | { type: 'chat.message'; conversationId: string; message: Message; at: string }
  | { type: 'chat.typing'; conversationId: string; userId: string; at: string }
  | { type: 'chat.read'; conversationId: string; readerId: string; readAt: string }
  | { type: 'privacy.changed'; userId: string; at: string };
