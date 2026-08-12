import 'server-only';
import type { SharedFocusSession } from '@/src/types/collaboration';

/**
 * In-process SSE hub. Connections are grouped by partnership id so focus mutations and
 * presence changes can be pushed straight to the partner's open tabs. State is kept in
 * memory (single server instance); MongoDB remains the source of truth for session data.
 */
export interface SseClient {
  userId: string;
  send: (payload: Record<string, unknown>) => void;
}

interface PartnershipEntry {
  clients: Map<string, SseClient>;
  activeSession: SharedFocusSession | null;
}

const partnerships = new Map<string, PartnershipEntry>();

function entry(partnershipId: string): PartnershipEntry {
  let existing = partnerships.get(partnershipId);
  if (!existing) {
    existing = { clients: new Map(), activeSession: null };
    partnerships.set(partnershipId, existing);
  }
  return existing;
}

export function connectClient(partnershipId: string, client: SseClient): () => void {
  entry(partnershipId).clients.set(client.userId, client);
  return () => {
    const current = partnerships.get(partnershipId);
    if (!current) return;
    current.clients.delete(client.userId);
    if (current.clients.size === 0) partnerships.delete(partnershipId);
  };
}

export function hasUserConnection(partnershipId: string, userId: string): boolean {
  return partnerships.get(partnershipId)?.clients.has(userId) ?? false;
}

export function userCount(partnershipId: string): number {
  return partnerships.get(partnershipId)?.clients.size ?? 0;
}

export function setActiveSession(partnershipId: string, session: SharedFocusSession | null): void {
  entry(partnershipId).activeSession = session;
}

export function getActiveSession(partnershipId: string): SharedFocusSession | null {
  return partnerships.get(partnershipId)?.activeSession ?? null;
}

export function broadcastPartnership(partnershipId: string, payload: Record<string, unknown>): void {
  const current = partnerships.get(partnershipId);
  if (!current) return;
  for (const client of current.clients.values()) {
    try {
      client.send(payload);
    } catch {
      // a broken stream is dropped on its next flush
    }
  }
}
