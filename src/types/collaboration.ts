import type { PlanFile } from '@/src/types';

/** Distinguishes personal plans (owned by one user) from common collaborative plans. */
export const PLAN_KIND = {
  PERSONAL: 'personal',
  COMMON: 'common',
} as const;

export type PlanKind = (typeof PLAN_KIND)[keyof typeof PLAN_KIND];

/** Visibility of a personal plan. Common plans are always shared via membership. */
export const PLAN_VISIBILITY = {
  PRIVATE: 'private',
  PARTNER_SHARED: 'partner_shared',
} as const;

export type PlanVisibility = (typeof PLAN_VISIBILITY)[keyof typeof PLAN_VISIBILITY];

export const PLAN_MEMBER_ROLE = {
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export type PlanMemberRole = (typeof PLAN_MEMBER_ROLE)[keyof typeof PLAN_MEMBER_ROLE];

export interface PlanMember {
  userId: string;
  role: PlanMemberRole;
  joinedAt: string;
}

export type UserStatus = 'online' | 'offline' | 'focusing' | 'away';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  status: UserStatus;
  lastSeenAt: string;
}

export const PARTNERSHIP_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended',
} as const;

export type PartnershipStatus = (typeof PARTNERSHIP_STATUS)[keyof typeof PARTNERSHIP_STATUS];

/**
 * How a partnership was established. In production the partner is always the single
 * preconfigured pair (`fixed_partner`, status `active`); there is no invitation flow.
 * `invite` remains only to describe legacy/dev records.
 */
export const PARTNERSHIP_RELATIONSHIP_TYPE = {
  INVITE: 'invite',
  FIXED_PARTNER: 'fixed_partner',
} as const;

export type PartnershipRelationshipType =
  (typeof PARTNERSHIP_RELATIONSHIP_TYPE)[keyof typeof PARTNERSHIP_RELATIONSHIP_TYPE];

export interface Partnership {
  id: string;
  userAId: string;
  userBId: string;
  status: PartnershipStatus;
  relationshipType?: PartnershipRelationshipType;
  invitedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerPrivacySettings {
  userId: string;
  shareWeeklyStats: boolean;
  shareStreak: boolean;
  sharePlans: boolean;
  shareLiveFocus: boolean;
  /** When off, the partner can no longer upload new snapshots (existing ones stay). */
  shareSnapshots: boolean;
}

export interface Conversation {
  id: string;
  partnershipId: string;
  createdAt: string;
  /** Per-user `lastReadAt` markers — the conversation-level read cursor used by Phase 10. */
  readState?: Record<string, string>;
}

export const MESSAGE_TYPE = {
  TEXT: 'text',
  IMAGE: 'image',
  PLAN_REFERENCE: 'plan_reference',
  FOCUS_SESSION_REFERENCE: 'focus_session_reference',
  SYSTEM: 'system',
} as const;

export type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];

export const MEDIA_STATUS = {
  ACTIVE: 'active',
  EXPORTED_AND_REMOVED: 'exported_and_removed',
} as const;

export type MediaStatus = (typeof MEDIA_STATUS)[keyof typeof MEDIA_STATUS];

/**
 * Client-side delivery state for messages this user has just sent. The server echo has no
 * `delivery` field — that is treated as "sent". `sending` marks the optimistic local copy.
 */
export type MessageDelivery = 'sending' | 'sent';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  body?: string | null;
  mediaId?: string | null;
  mediaMime?: string | null;
  mediaSize?: number | null;
  mediaStatus?: MediaStatus;
  planId?: number | null;
  sharedFocusId?: string | null;
  readAt?: string | null;
  delivery?: MessageDelivery;
  createdAt: string;
}

export const SHARED_FOCUS_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  ENDED: 'ended',
} as const;

export type SharedFocusStatus = (typeof SHARED_FOCUS_STATUS)[keyof typeof SHARED_FOCUS_STATUS];

export interface SharedFocusParticipant {
  userId: string;
  ready: boolean;
  joinedAt: string;
  completed: boolean;
}

export interface SharedFocusSession {
  id: string;
  partnershipId: string;
  status: SharedFocusStatus;
  durationMinutes: number;
  startedAt: string | null;
  pausedAt: string | null;
  totalPausedMs: number;
  endsAt: string | null;
  createdBy: string;
  participants: SharedFocusParticipant[];
  createdAt: string;
}

/**
 * The local-first persistence payload for collaboration data. Stored separately from
 * `storage/data.json` so the legacy file remains the migration source and stays pristine.
 * When a cloud backend is configured, this shape maps 1:1 to cloud tables and is replaced.
 */
export interface CollabData {
  version: 1;
  currentUserId: string | null;
  profiles: Profile[];
  partnerships: Partnership[];
  privacySettings: PartnerPrivacySettings[];
  conversations: Conversation[];
  messages: Message[];
  sharedFocusSessions: SharedFocusSession[];
  mediaMeta: Record<string, MediaMeta>;
}

export interface MediaMeta {
  id: string;
  messageId: string;
  conversationId?: string;
  ownerId?: string;
  fileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  status: MediaStatus;
  createdAt: string;
}

export interface MigrationRowCounts {
  users: number;
  plans: number;
  sessions: number;
  files: number;
}

export interface MigrationStateRecord {
  migrationName: string;
  version: number;
  sourceChecksum: string;
  completedAt: string;
  rowCounts: MigrationRowCounts;
}

export interface MigrationReport {
  usersMigrated: number;
  plansMigrated: number;
  sessionsMigrated: number;
  filesMigrated: number;
  errors: number;
  messages: string[];
}

/** Optional collaborative fields added to the existing Plan model (all optional). */
export interface PlanCollaborationFields {
  planType?: PlanKind;
  visibility?: PlanVisibility;
  ownerId?: string;
  memberRole?: PlanMemberRole;
  memberCount?: number;
  updatedAt?: string;
}

export interface PlanFileMeta extends PlanFile {
  ownerId?: string;
}

export function isPlanKind(value: unknown): value is PlanKind {
  return typeof value === 'string' && (Object.values(PLAN_KIND) as string[]).includes(value);
}

export function isPlanVisibility(value: unknown): value is PlanVisibility {
  return typeof value === 'string' && (Object.values(PLAN_VISIBILITY) as string[]).includes(value);
}

export function isPlanMemberRole(value: unknown): value is PlanMemberRole {
  return typeof value === 'string' && (Object.values(PLAN_MEMBER_ROLE) as string[]).includes(value);
}

export function isPartnershipStatus(value: unknown): value is PartnershipStatus {
  return typeof value === 'string' && (Object.values(PARTNERSHIP_STATUS) as string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Paged / aggregate DTOs (Phase 11+). All pages are cursor-based and never load
// the full collection into memory.
// ---------------------------------------------------------------------------

/** A page of chat messages, oldest-first, with a cursor for the previous (older) page. */
export interface MessagePage {
  items: Message[];
  hasOlder: boolean;
  nextCursor: string | null;
}

/** A single entry in the shared-activity feed (currently ended shared-focus sessions). */
export interface SharedActivityItem {
  id: string;
  type: 'shared_focus';
  title: string;
  subtitle: string;
  minutes: number;
  status: SharedFocusStatus;
  createdAt: string;
}

export interface ActivityPage {
  items: SharedActivityItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

/** A page of the user's own plans, newest-first by `updatedAt`. */
export interface PlanPage {
  items: import('@/src/types').Plan[];
  hasMore: boolean;
  nextCursor: string | null;
}

/** A snapshot (image message) exposed to the chat gallery. */
export interface SnapshotItem {
  id: string;
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  caption: string | null;
  mediaId: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: MediaStatus;
  exported: boolean;
  createdAt: string;
  /** Authorised media URL served by /api/media — safe to use in <img src>. */
  url: string;
}

export interface SnapshotPage {
  items: SnapshotItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ZipExportResult {
  fileName: string;
  base64: string;
  exported: string[];
  failed: { id: string; reason: string }[];
}

export interface SnapshotRemoveResult {
  removed: string[];
  failed: { id: string; reason: string }[];
}

export function isUserStatus(value: unknown): value is UserStatus {
  return value === 'online' || value === 'offline' || value === 'focusing' || value === 'away';
}
