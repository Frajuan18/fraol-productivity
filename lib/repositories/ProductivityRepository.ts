import type { AppData, Plan, PlanStatus, Session, Stats } from '@/src/types';
import type { AnalyticsResult } from '@/lib/analytics/types';
import type { HistorySignals } from '@/lib/assistant/types';
import type { DashboardLayout } from '@/lib/dashboard/types';
import type {
  ActivityPage,
  Conversation,
  MediaMeta,
  Message,
  MessagePage,
  PartnerPrivacySettings,
  Partnership,
  PlanMemberRole,
  PlanPage,
  PlanVisibility,
  Profile,
  SharedFocusSession,
  SnapshotPage,
  SnapshotRemoveResult,
  UserStatus,
  ZipExportResult,
} from '@/src/types/collaboration';

export type RepositoryMode = 'local' | 'mongodb';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface PlanInput {
  title: string;
  description: string;
  type: string;
  status?: PlanStatus;
  date?: string;
  priority: string;
  category: string;
  file?: import('@/src/types').PlanFile | null;
}

export interface SessionInput {
  task: string;
  duration: string;
  date: string;
  status: string;
  startTime?: string;
  endTime?: string;
  actualDuration?: string;
}

/** One page of a cursor-paginated session history. `nextCursor` is null when exhausted. */
export interface SessionPage {
  items: Session[];
  nextCursor: string | null;
}

export const SESSION_PAGE_SIZE = 60;

export interface SendMessageInput {
  type: string;
  body?: string | null;
  mediaId?: string | null;
  mediaMime?: string | null;
  mediaSize?: number | null;
  planId?: number | null;
  sharedFocusId?: string | null;
}

/** Input for attaching an already-stored image (GridFS) to the chat as a snapshot message. */
export interface SnapshotSaveInput {
  mediaId: string;
  fileName: string;
  mimeType: string;
  size: number;
  caption?: string | null;
}

export interface PartnerView {
  profile: Profile;
  partnership: Partnership;
  privacy: PartnerPrivacySettings | null;
  conversation: Conversation;
}

/**
 * The single payload for the partner workspace Overview tab. Privacy filtering is applied
 * on the backend: shared plans and statistics are only included when the partner's privacy
 * settings allow it.
 */
export interface PartnerOverview extends PartnerView {
  sharedPlans: Plan[];
  statistics: PartnerStatistics;
}

export interface PartnerStatistics {
  privacyEnabled: boolean;
  focusMinutesToday: number;
  focusMinutesThisWeek: number;
  completedSessions: number;
  currentStreak: number;
  weeklyChange: number;
  weeklyChangeDisplay: string;
  recentActivity: { date: string; task: string; minutes: number }[];
}

export interface RealtimeHandlers {
  onPartnerStatus?: (partnerId: string, status: Profile['status'], lastSeenAt: string) => void;
  onMessage?: (message: Message) => void;
  onTyping?: (senderId: string, at: string) => void;
  onRead?: (conversationId: string, readerId: string, readAt: string) => void;
  onSharedFocus?: (sessionId: string, status: string) => void;
  onPlanChanged?: (planId: number) => void;
}

/**
 * Single data-access seam the UI is allowed to talk to. Two adapters implement the same
 * contract:
 * - LocalJsonProductivityRepository — preserves today's JSON behaviour (dev fallback).
 * - MongoDbProductivityRepository — MongoDB is the production source of truth after
 *   migration; image binaries live in the `chatSnapshots` GridFS bucket.
 * Components never touch storage, MongoDB, or GridFS directly.
 */
export interface ProductivityRepository {
  readonly mode: RepositoryMode;

  // ---- Identity -----------------------------------------------------------
  getCurrentUser(): Promise<AuthUser | null>;

  // ---- Core app data (legacy JSON compatibility for the dashboard) --------
  loadAppData(): Promise<AppData>;
  saveAppData(data: AppData): Promise<boolean>;

  // ---- Plans --------------------------------------------------------------
  getMyPlans(userId: string): Promise<Plan[]>;
  getPlanById(planId: number, userId: string): Promise<Plan | null>;
  createPersonalPlan(userId: string, input: PlanInput): Promise<Plan>;
  updatePersonalPlan(userId: string, planId: number, updates: Partial<Plan>): Promise<Plan | null>;
  deletePlan(userId: string, planId: number): Promise<boolean>;
  changePlanVisibility(userId: string, planId: number, visibility: PlanVisibility): Promise<Plan | null>;
  getCommonPlans(userId: string): Promise<Plan[]>;
  createCommonPlan(userId: string, input: PlanInput): Promise<Plan>;
  updateCommonPlan(
    userId: string,
    planId: number,
    updates: Partial<Plan>,
    expectedUpdatedAt?: string,
  ): Promise<Plan | null>;

  // ---- Sessions -----------------------------------------------------------
  getSessions(userId: string): Promise<Session[]>;
  listSessions(userId: string, cursor?: string, limit?: number): Promise<SessionPage>;
  createSession(userId: string, input: SessionInput): Promise<Session>;

  // ---- Paged history (Phase 11) -------------------------------------------
  /**
   * Cursor-paginated chat. The first page is the newest `limit` messages oldest-first.
   * Older pages are fetched with `cursor` = the oldest loaded message's `createdAt`.
   */
  listMessagesPaged(userId: string, conversationId: string, cursor?: string, limit?: number): Promise<MessagePage>;
  /** Shared-activity feed for the partnership, newest-first. */
  listSharedActivity(userId: string, cursor?: string, limit?: number): Promise<ActivityPage>;
  /** The user's own plans (personal + common membership), newest-first by updatedAt. */
  listPlansPaged(userId: string, cursor?: string, limit?: number): Promise<PlanPage>;

  // ---- Shared focus (realtime, server-authoritative) ----------------------
  setUserStatus(userId: string, status: UserStatus): Promise<void>;
  getActiveSharedFocus(userId: string): Promise<SharedFocusSession | null>;
  startSharedFocus(userId: string, durationMinutes: number): Promise<SharedFocusSession | null>;
  pauseSharedFocus(userId: string, sessionId: string): Promise<SharedFocusSession | null>;
  resumeSharedFocus(userId: string, sessionId: string): Promise<SharedFocusSession | null>;
  completeSharedFocus(userId: string, sessionId: string): Promise<SharedFocusSession | null>;
  cancelSharedFocus(userId: string, sessionId: string): Promise<SharedFocusSession | null>;

  // ---- Statistics ---------------------------------------------------------
  getStatistics(userId: string): Promise<Stats>;

  // ---- Partner ------------------------------------------------------------
  getPartner(userId: string): Promise<PartnerView | null>;
  getPartnerSharedPlans(userId: string): Promise<Plan[]>;
  getPartnerStatistics(userId: string): Promise<PartnerStatistics | null>;
  getPartnerOverview(userId: string): Promise<PartnerOverview | null>;
  getProfile(userId: string): Promise<Profile | null>;

  // ---- Partner privacy -----------------------------------------------------
  getPrivacySettings(userId: string): Promise<PartnerPrivacySettings>;
  updatePrivacySettings(userId: string, updates: Partial<PartnerPrivacySettings>): Promise<PartnerPrivacySettings>;
  /**
   * The status to broadcast to the partner's SSE stream. A "focusing" status is coerced to
   * "online" when the user's live-focus sharing is disabled, so protected state is never
   * leaked through presence events.
   */
  getMaskedStatus(userId: string, status: UserStatus): Promise<UserStatus>;
  /**
   * Like getMaskedStatus but also gates the "last seen" timestamp: when live-focus sharing
   * is disabled, lastSeenAt is masked to '' so no presence detail leaks through the stream.
   */
  getMaskedPresence(userId: string, status: UserStatus): Promise<{ status: UserStatus; lastSeenAt: string }>;

  // ---- Conversation / Chat -------------------------------------------------
  getConversation(userId: string, partnerId: string): Promise<Conversation>;
  listMessages(userId: string, conversationId: string, cursor?: string, limit?: number): Promise<Message[]>;
  sendMessage(userId: string, conversationId: string, input: SendMessageInput): Promise<Message>;
  markRead(userId: string, conversationId: string): Promise<boolean>;
  sendTyping(userId: string, conversationId: string): Promise<boolean>;

  // ---- Shared snapshots (Phase 13) -----------------------------------------
  /** Newest-first gallery of image messages in the conversation. */
  listSnapshots(userId: string, conversationId: string, cursor?: string, limit?: number): Promise<SnapshotPage>;
  /** Attaches a stored image to the chat as a snapshot message. Binary goes through /api/snapshots/upload. */
  saveSnapshot(userId: string, conversationId: string, input: SnapshotSaveInput): Promise<Message>;
  /**
   * Builds a ZIP of the requested snapshots and returns it as base64. Nothing is deleted
   * here — removal is a separate, explicit step that only succeeds after an export.
   */
  exportSnapshots(userId: string, conversationId: string, messageIds: string[]): Promise<ZipExportResult>;
  /** Deletes snapshot binaries/metadata only for items already exported, then inserts system notes. */
  removeSnapshotsAfterExport(
    userId: string,
    conversationId: string,
    messageIds: string[],
  ): Promise<SnapshotRemoveResult>;

  // ---- Productivity analytics (Phase 16) -------------------------------------
  /**
   * Aggregated summaries (daily/weekly/monthly) plus generated insights for the user.
   * Aggregates are precomputed in MongoDB; the local mode cannot compute them and returns
   * an empty result. UI components render the empty state as "not available" when offline.
   */
  getAnalytics(userId: string): Promise<AnalyticsResult>;
  /** Forces a recompute after writes so fresh insights are served on the next read. */
  refreshAnalytics(userId: string): Promise<AnalyticsResult>;

  // ---- Smart planning assistant (Phase 17) -------------------------------------
  /**
   * Compact, derived signals about the user's focus/plan history that the plan assistant
   * uses. Only signals are returned — raw history never leaves the server. Local mode
   * computes the same values directly from the stored sessions/plans.
   */
  getPlanningSignals(userId: string): Promise<HistorySignals>;

  // ---- Customizable dashboard layout (Phase 18) ------------------------------------
  /**
   * The user's saved dashboard widget configuration. Unknown/stale shapes are normalised
   * server-side; callers can always rely on receiving a well-formed layout even on first
   * run (the default layout is returned when nothing is stored yet).
   */
  getDashboardLayout(userId: string): Promise<DashboardLayout>;
  /** Persists a normalised dashboard layout for the user. */
  saveDashboardLayout(userId: string, layout: DashboardLayout): Promise<boolean>;

  // ---- Collaboration state (local fallback / legacy) -----------------------
  loadCollabData(): Promise<import('@/src/types/collaboration').CollabData>;
  saveCollabData(data: import('@/src/types/collaboration').CollabData): Promise<boolean>;

  // ---- Media metadata (binaries live in GridFS) ----------------------------
  saveMedia(meta: MediaMeta): Promise<MediaMeta>;
  getMedia(mediaId: string): Promise<MediaMeta | null>;
  updateMedia(mediaId: string, patch: Partial<MediaMeta>): Promise<MediaMeta | null>;

  // ---- Realtime ------------------------------------------------------------
  subscribe(room: string, handlers: RealtimeHandlers): () => void;
}

export const DEFAULT_PARTNER_PRIVACY: Omit<PartnerPrivacySettings, 'userId'> = {
  shareWeeklyStats: true,
  shareStreak: true,
  sharePlans: true,
  shareLiveFocus: true,
  shareSnapshots: true,
};

export const PLAN_MEMBER_ROLE_ORDER: Record<PlanMemberRole, number> = {
  owner: 0,
  editor: 1,
  viewer: 2,
};
