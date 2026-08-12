import type { AppData, Plan, Session, Stats } from '@/src/types';
import type {
  ActivityPage,
  CollabData,
  Conversation,
  MediaMeta,
  Message,
  MessagePage,
  PartnerPrivacySettings,
  PlanPage,
  PlanVisibility,
  SharedFocusSession,
  SnapshotPage,
  SnapshotRemoveResult,
  UserStatus,
  ZipExportResult,
} from '@/src/types/collaboration';
import { getDefaultCollabData } from '@/src/validators/collaboration';
import type {
  AuthUser,
  PartnerOverview,
  PartnerStatistics,
  PartnerView,
  PlanInput,
  ProductivityRepository,
  RealtimeHandlers,
  RepositoryMode,
  SendMessageInput,
  SessionInput,
  SessionPage,
  SnapshotSaveInput,
} from '@/lib/repositories/ProductivityRepository';
import type { Profile } from '@/src/types/collaboration';
import type { AnalyticsResult } from '@/lib/analytics/types';
import type { HistorySignals } from '@/lib/assistant/types';
import type { DashboardLayout } from '@/lib/dashboard/types';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Client-side HTTP proxy for the MongoDB repository. Implements the exact same contract
 * as the local adapter by posting typed actions to the authenticated /api/repository
 * gateway. The browser never holds MongoDB credentials or executes MongoDB queries.
 */
export class RepositoryClient implements ProductivityRepository {
  readonly mode: RepositoryMode = 'mongodb';

  private async call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch('/api/repository', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    const body = (await response.json().catch(() => ({}))) as ApiResponse<T>;
    if (!response.ok || !body.ok) {
      const err = new Error(body.error || `Request failed (${response.status})`) as Error & { code?: string };
      if (body.code) err.code = body.code;
      throw err;
    }
    return body.data as T;
  }

  // ---- Identity -----------------------------------------------------------

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      return await this.call<AuthUser>('currentUser.get');
    } catch {
      return null;
    }
  }

  // ---- Core app data ------------------------------------------------------

  async loadAppData(): Promise<AppData> {
    try {
      return await this.call<AppData>('appData.load');
    } catch {
      return {
        plans: [],
        sessions: [],
        stats: {} as Stats,
        user: { name: '', streak: 0, totalFocusHours: 0, taskTypes: [] },
      };
    }
  }

  async saveAppData(): Promise<boolean> {
    return false;
  }

  // ---- Plans --------------------------------------------------------------

  async getMyPlans(_userId: string): Promise<Plan[]> {
    return this.call<Plan[]>('plans.my');
  }

  async getCommonPlans(_userId: string): Promise<Plan[]> {
    return this.call<Plan[]>('plans.common');
  }

  async getPlanById(planId: number): Promise<Plan | null> {
    try {
      return await this.call<Plan | null>('plans.byId', { planId });
    } catch {
      return null;
    }
  }

  async createPersonalPlan(_userId: string, input: PlanInput): Promise<Plan> {
    return this.call<Plan>('plans.createPersonal', { input });
  }

  async createCommonPlan(_userId: string, input: PlanInput): Promise<Plan> {
    return this.call<Plan>('plans.createCommon', { input });
  }

  async updatePersonalPlan(_userId: string, planId: number, updates: Partial<Plan>): Promise<Plan | null> {
    return this.call<Plan | null>('plans.updatePersonal', { planId, updates });
  }

  async updateCommonPlan(
    _userId: string,
    planId: number,
    updates: Partial<Plan>,
    expectedUpdatedAt?: string,
  ): Promise<Plan | null> {
    return this.call<Plan | null>('plans.updateCommon', { planId, updates, expectedUpdatedAt });
  }

  async deletePlan(_userId: string, planId: number): Promise<boolean> {
    return this.call<boolean>('plans.delete', { planId });
  }

  async changePlanVisibility(_userId: string, planId: number, visibility: PlanVisibility): Promise<Plan | null> {
    return this.call<Plan | null>('plans.changeVisibility', { planId, visibility });
  }

  // ---- Sessions -----------------------------------------------------------

  async getSessions(_userId: string): Promise<Session[]> {
    return this.call<Session[]>('sessions.list');
  }

  async listSessions(_userId: string, cursor?: string, limit?: number): Promise<SessionPage> {
    return this.call<SessionPage>('sessions.listPaged', { cursor, limit });
  }

  async createSession(_userId: string, input: SessionInput): Promise<Session> {
    return this.call<Session>('sessions.create', { input });
  }

  // ---- Statistics ---------------------------------------------------------

  async getStatistics(_userId: string): Promise<Stats> {
    return this.call<Stats>('stats.get');
  }

  // ---- Productivity analytics (Phase 16) -----------------------------------

  async getAnalytics(_userId: string): Promise<AnalyticsResult> {
    return this.call<AnalyticsResult>('analytics.get');
  }

  async refreshAnalytics(_userId: string): Promise<AnalyticsResult> {
    return this.call<AnalyticsResult>('analytics.refresh');
  }

  async getPlanningSignals(_userId: string): Promise<HistorySignals> {
    return this.call<HistorySignals>('assistant.signals');
  }

  // ---- Customizable dashboard layout (Phase 18) ------------------------------------

  async getDashboardLayout(_userId: string): Promise<DashboardLayout> {
    return this.call<DashboardLayout>('dashboard.layout.get');
  }

  async saveDashboardLayout(_userId: string, layout: DashboardLayout): Promise<boolean> {
    return this.call<boolean>('dashboard.layout.save', { layout });
  }

  // ---- Partner ------------------------------------------------------------

  async getPartner(_userId: string): Promise<PartnerView | null> {
    try {
      return await this.call<PartnerView | null>('partner.get');
    } catch {
      return null;
    }
  }

  async getPartnerSharedPlans(_userId: string): Promise<Plan[]> {
    return this.call<Plan[]>('partner.sharedPlans');
  }

  async getPartnerStatistics(_userId: string): Promise<PartnerStatistics | null> {
    try {
      return await this.call<PartnerStatistics | null>('partner.statistics');
    } catch {
      return null;
    }
  }

  async getPartnerOverview(_userId: string): Promise<PartnerOverview | null> {
    try {
      const response = await fetch('/api/partner/overview');
      const body = (await response.json().catch(() => ({}))) as ApiResponse<PartnerOverview>;
      if (!response.ok || !body.ok) return null;
      return (body.data as PartnerOverview) ?? null;
    } catch {
      return null;
    }
  }

  async getProfile(_userId: string): Promise<Profile | null> {
    try {
      return await this.call<Profile | null>('profile.get', { userId: _userId });
    } catch {
      return null;
    }
  }

  // ---- Partner privacy ----------------------------------------------------

  async getPrivacySettings(_userId: string): Promise<PartnerPrivacySettings> {
    return this.call<PartnerPrivacySettings>('privacy.get');
  }

  async updatePrivacySettings(
    _userId: string,
    updates: Partial<PartnerPrivacySettings>,
  ): Promise<PartnerPrivacySettings> {
    return this.call<PartnerPrivacySettings>('privacy.update', { updates });
  }

  async getMaskedStatus(_userId: string, status: UserStatus): Promise<UserStatus> {
    return this.call<UserStatus>('privacy.maskedStatus', { status });
  }

  async getMaskedPresence(_userId: string, status: UserStatus): Promise<{ status: UserStatus; lastSeenAt: string }> {
    return this.call<{ status: UserStatus; lastSeenAt: string }>('privacy.maskedPresence', { status });
  }

  // ---- Paged history ------------------------------------------------------

  async listMessagesPaged(
    _userId: string,
    conversationId: string,
    cursor?: string,
    limit?: number,
  ): Promise<MessagePage> {
    return this.call<MessagePage>('messages.listPaged', { conversationId, cursor, limit });
  }

  async listSharedActivity(_userId: string, cursor?: string, limit?: number): Promise<ActivityPage> {
    return this.call<ActivityPage>('activity.list', { cursor, limit });
  }

  async listPlansPaged(_userId: string, cursor?: string, limit?: number): Promise<PlanPage> {
    return this.call<PlanPage>('plans.listPaged', { cursor, limit });
  }

  // ---- Conversation / Chat ------------------------------------------------

  async getConversation(_userId: string, partnerId: string): Promise<Conversation> {
    return this.call<Conversation>('conversation.get', { partnerId });
  }

  async listMessages(_userId: string, conversationId: string, cursor?: string, limit?: number): Promise<Message[]> {
    return this.call<Message[]>('messages.list', { conversationId, cursor, limit });
  }

  async sendMessage(_userId: string, conversationId: string, input: SendMessageInput): Promise<Message> {
    return this.call<Message>('messages.send', { conversationId, input });
  }

  async markRead(_userId: string, conversationId: string): Promise<boolean> {
    return this.call<boolean>('messages.markRead', { conversationId });
  }

  async sendTyping(_userId: string, conversationId: string): Promise<boolean> {
    return this.call<boolean>('messages.typing', { conversationId });
  }

  // ---- Shared snapshots ----------------------------------------------------

  async listSnapshots(_userId: string, conversationId: string, cursor?: string, limit?: number): Promise<SnapshotPage> {
    return this.call<SnapshotPage>('snapshots.list', { conversationId, cursor, limit });
  }

  async saveSnapshot(_userId: string, conversationId: string, input: SnapshotSaveInput): Promise<Message> {
    return this.call<Message>('snapshots.save', { conversationId, input });
  }

  async exportSnapshots(_userId: string, conversationId: string, messageIds: string[]): Promise<ZipExportResult> {
    return this.call<ZipExportResult>('snapshots.export', { conversationId, messageIds });
  }

  async removeSnapshotsAfterExport(
    _userId: string,
    conversationId: string,
    messageIds: string[],
  ): Promise<SnapshotRemoveResult> {
    return this.call<SnapshotRemoveResult>('snapshots.remove', { conversationId, messageIds });
  }

  // ---- Collaboration state -------------------------------------------------

  async loadCollabData(): Promise<CollabData> {
    return getDefaultCollabData();
  }

  async saveCollabData(): Promise<boolean> {
    return true;
  }

  // ---- Media metadata ------------------------------------------------------

  async saveMedia(_meta: MediaMeta): Promise<MediaMeta> {
    throw new Error('Upload media through /api/media instead.');
  }

  async getMedia(mediaId: string): Promise<MediaMeta | null> {
    try {
      return await this.call<MediaMeta | null>('media.get', { mediaId });
    } catch {
      return null;
    }
  }

  async updateMedia(mediaId: string, patch: Partial<MediaMeta>): Promise<MediaMeta | null> {
    return this.call<MediaMeta | null>('media.update', { mediaId, patch });
  }

  // ---- Realtime -----------------------------------------------------------

  subscribe(_room: string, _handlers: RealtimeHandlers): () => void {
    // SSE realtime connection is established by the RealtimeProvider (see app/api/realtime).
    return () => undefined;
  }

  // ---- Shared focus (realtime, server-authoritative) ----------------------

  async setUserStatus(_userId: string, status: UserStatus): Promise<void> {
    await this.call('presence.set', { status });
  }

  async getActiveSharedFocus(_userId: string): Promise<SharedFocusSession | null> {
    return this.call<SharedFocusSession | null>('focus.getActive');
  }

  async startSharedFocus(_userId: string, durationMinutes: number): Promise<SharedFocusSession | null> {
    return this.call<SharedFocusSession | null>('focus.start', { durationMinutes });
  }

  async pauseSharedFocus(_userId: string, sessionId: string): Promise<SharedFocusSession | null> {
    return this.call<SharedFocusSession | null>('focus.pause', { sessionId });
  }

  async resumeSharedFocus(_userId: string, sessionId: string): Promise<SharedFocusSession | null> {
    return this.call<SharedFocusSession | null>('focus.resume', { sessionId });
  }

  async completeSharedFocus(_userId: string, sessionId: string): Promise<SharedFocusSession | null> {
    return this.call<SharedFocusSession | null>('focus.complete', { sessionId });
  }

  async cancelSharedFocus(_userId: string, sessionId: string): Promise<SharedFocusSession | null> {
    return this.call<SharedFocusSession | null>('focus.cancel', { sessionId });
  }
}
