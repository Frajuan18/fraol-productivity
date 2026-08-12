import { dataService } from '@/lib/dataService';
import { collabService } from '@/lib/collaboration/collabService';
import { dashboardLayoutService } from '@/lib/dashboard/layoutService';
import { normalizeLayout } from '@/lib/dashboard/layout';
import { assertNotStale } from '@/lib/repositories/planConcurrency';
import { deriveReadState } from '@/lib/realtime/readState';
import { maskFocusStatus } from '@/lib/repositories/privacyMath';
import { buildSessionPage, sessionBeforeCursor, sortSessionsNewestFirst } from '@/lib/repositories/sessionPaging';
import { buildMessagePage, messageBeforeCursor, sortMessagesOldestFirst } from '@/lib/repositories/chatPaging';
import { buildActivityPage, activityBeforeCursor } from '@/lib/repositories/activityMath';
import { buildPlanPage, planBeforeCursor, sortPlansNewestFirst } from '@/lib/repositories/planPaging';
import { DEFAULT_PARTNER_PRIVACY } from '@/lib/repositories/ProductivityRepository';
import type { AnalyticsResult } from '@/lib/analytics/types';
import {
  MESSAGE_TYPE,
  PLAN_VISIBILITY,
  type ActivityPage,
  type CollabData,
  type Conversation,
  type MediaMeta,
  type Message,
  type MessagePage,
  type PartnerPrivacySettings,
  type PlanPage,
  type PlanVisibility,
  type Profile,
  type SharedActivityItem,
  type SharedFocusSession,
  type SnapshotPage,
  type SnapshotRemoveResult,
  type UserStatus,
  type ZipExportResult,
} from '@/src/types/collaboration';
import { getDefaultCollabData } from '@/src/validators/collaboration';
import {
  calculateStreak,
  calculateWeeklyChange,
  focusMinutesThisWeek,
  countSessionsByStatus,
  groupSessionsByDate,
} from '@/src/utils/statistics';
import { SESSION_STATUS, PLAN_STATUS, type AppData, type Plan, type PlanStatus, type Session, type Stats } from '@/src/types';
import { parseDuration } from '@/src/utils/time';
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

export const LOCAL_REALTIME_EVENT = 'mywhiteboard:collab';

const DEMO_USER_ID = 'demo-user';

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const PRIVACY_FIELDS = ['shareWeeklyStats', 'shareStreak', 'sharePlans', 'shareLiveFocus', 'shareSnapshots'] as const;

function pickPrivacyFields(updates: Partial<PartnerPrivacySettings>): Partial<PartnerPrivacySettings> {
  const picked: Partial<PartnerPrivacySettings> = {};
  for (const key of PRIVACY_FIELDS) {
    if (typeof updates[key] === 'boolean') picked[key] = updates[key];
  }
  return picked;
}

/**
 * Local-first adapter. Core app data persists to the legacy JSON file (via /api/data)
 * and collaboration data to a separate file (via /api/collaboration), keeping
 * `storage/data.json` intact as the migration source. This is the development fallback
 * and the reference implementation for the repository contract.
 */
export class LocalJsonProductivityRepository implements ProductivityRepository {
  readonly mode: RepositoryMode = 'local';

  async getCurrentUser(): Promise<AuthUser | null> {
    const data = await this.loadCollabData();
    if (data.currentUserId) {
      const profile = data.profiles.find((p) => p.id === data.currentUserId);
      if (profile) return { id: profile.id, email: profile.email, displayName: profile.displayName };
    }
    return null;
  }

  // ---- Core app data ------------------------------------------------------

  async loadAppData(): Promise<AppData> {
    return dataService.loadData();
  }

  async saveAppData(data: AppData): Promise<boolean> {
    return dataService.saveData(data);
  }

  // ---- Plans --------------------------------------------------------------

  async getMyPlans(userId: string): Promise<Plan[]> {
    const data = await this.loadAppData();
    const all = data.plans;
    if (userId === DEMO_USER_ID) return all.filter((p) => p.planType !== 'common');
    return all.filter((p) => p.planType !== 'common' && (p.ownerId === undefined || p.ownerId === userId));
  }

  async getCommonPlans(userId: string): Promise<Plan[]> {
    const data = await this.loadAppData();
    return data.plans
      .filter((p) => p.planType === 'common')
      .map((p) => ({ ...p, memberRole: p.ownerId === userId ? ('owner' as const) : ('editor' as const) }));
  }

  async getPlanById(planId: number, _userId: string): Promise<Plan | null> {
    const data = await this.loadAppData();
    return data.plans.find((p) => p.id === planId) ?? null;
  }

  async createPersonalPlan(userId: string, input: PlanInput): Promise<Plan> {
    const plan = this.buildPlan(userId, input, 'personal');
    const data = await this.loadAppData();
    data.plans = [plan, ...data.plans];
    await dataService.saveData(data);
    return plan;
  }

  async createCommonPlan(userId: string, input: PlanInput): Promise<Plan> {
    const plan = this.buildPlan(userId, input, 'common');
    const data = await this.loadAppData();
    data.plans = [plan, ...data.plans];
    await dataService.saveData(data);
    return plan;
  }

  async updatePersonalPlan(userId: string, planId: number, updates: Partial<Plan>): Promise<Plan | null> {
    const data = await this.loadAppData();
    const index = data.plans.findIndex((p) => p.id === planId && p.planType !== 'common');
    if (index === -1) return null;
    data.plans[index] = { ...data.plans[index], ...updates, updatedAt: new Date().toISOString() };
    await dataService.saveData(data);
    return data.plans[index];
  }

  async updateCommonPlan(userId: string, planId: number, updates: Partial<Plan>, expectedUpdatedAt?: string): Promise<Plan | null> {
    const data = await this.loadAppData();
    const index = data.plans.findIndex((p) => p.id === planId && p.planType === 'common');
    if (index === -1) return null;
    assertNotStale(data.plans[index].updatedAt, expectedUpdatedAt);
    data.plans[index] = { ...data.plans[index], ...updates, updatedAt: new Date().toISOString() };
    await dataService.saveData(data);
    return { ...data.plans[index], memberRole: data.plans[index].ownerId === userId ? 'owner' : 'editor' };
  }

  async deletePlan(userId: string, planId: number): Promise<boolean> {
    const data = await this.loadAppData();
    const before = data.plans.length;
    data.plans = data.plans.filter((p) => p.id !== planId);
    if (data.plans.length === before) return false;
    await dataService.saveData(data);
    void userId;
    return true;
  }

  async changePlanVisibility(
    userId: string,
    planId: number,
    visibility: PlanVisibility,
  ): Promise<Plan | null> {
    return this.updatePersonalPlan(userId, planId, { visibility });
  }

  // ---- Sessions -----------------------------------------------------------

  async getSessions(_userId: string): Promise<Session[]> {
    const data = await this.loadAppData();
    return data.sessions;
  }

  async listSessions(_userId: string, cursor?: string, limit = 60): Promise<SessionPage> {
    const data = await this.loadAppData();
    const pageSize = Math.max(1, Math.min(200, Math.round(limit)));
    const beforeCursor = cursor ? data.sessions.filter((s) => sessionBeforeCursor(s, cursor)) : data.sessions;
    return buildSessionPage(sortSessionsNewestFirst(beforeCursor), pageSize);
  }

  async createSession(userId: string, input: SessionInput): Promise<Session> {
    const session: Session = {
      id: Date.now(),
      task: input.task,
      duration: input.duration,
      date: input.date,
      status: (input.status as Session['status']) ?? SESSION_STATUS.COMPLETED,
      startTime: input.startTime,
      endTime: input.endTime,
      actualDuration: input.actualDuration,
      createdAt: new Date().toISOString(),
    };
    const data = await this.loadAppData();
    data.sessions = [session, ...data.sessions];
    await dataService.saveData(data);
    void userId;
    return session;
  }

  // ---- Shared focus (realtime) --------------------------------------------

  async setUserStatus(_userId: string, _status: UserStatus): Promise<void> {
    // Local mode has no live transport; presence is read from collab data.
  }

  async getActiveSharedFocus(_userId: string): Promise<SharedFocusSession | null> {
    return null;
  }

  async startSharedFocus(_userId: string, _durationMinutes: number): Promise<SharedFocusSession | null> {
    return null;
  }

  async pauseSharedFocus(_userId: string, _sessionId: string): Promise<SharedFocusSession | null> {
    return null;
  }

  async resumeSharedFocus(_userId: string, _sessionId: string): Promise<SharedFocusSession | null> {
    return null;
  }

  async completeSharedFocus(_userId: string, _sessionId: string): Promise<SharedFocusSession | null> {
    return null;
  }

  async cancelSharedFocus(_userId: string, _sessionId: string): Promise<SharedFocusSession | null> {
    return null;
  }

  // ---- Statistics ---------------------------------------------------------

  async getStatistics(_userId: string): Promise<Stats> {
    const data = await this.loadAppData();
    return data.stats;
  }

  // ---- Productivity analytics (Phase 16) -----------------------------------
  // Local mode has no aggregated history to draw from, so it always reports an empty
  // result. The UI renders this as "not available" (e.g. when running without MongoDB).

  async getAnalytics(userId: string): Promise<AnalyticsResult> {
    return {
      userId,
      computedAt: new Date().toISOString(),
      daily: [],
      weekly: [],
      monthly: [],
      insights: [],
    };
  }

  async refreshAnalytics(userId: string): Promise<AnalyticsResult> {
    return this.getAnalytics(userId);
  }

  async getPlanningSignals(userId: string): Promise<import('@/lib/assistant/types').HistorySignals> {
    const data = await this.loadAppData();
    const { computeHistorySignals } = await import('@/lib/assistant/signals');
    return computeHistorySignals(data.sessions, data.plans);
  }

  // ---- Customizable dashboard layout (Phase 18) -----------------------------------

  async getDashboardLayout(_userId: string): Promise<import('@/lib/dashboard/types').DashboardLayout> {
    const stored = await dashboardLayoutService.load();
    return normalizeLayout(stored);
  }

  async saveDashboardLayout(_userId: string, layout: import('@/lib/dashboard/types').DashboardLayout): Promise<boolean> {
    return dashboardLayoutService.save(normalizeLayout(layout));
  }

  // ---- Partner ------------------------------------------------------------

  async getPartner(userId: string): Promise<PartnerView | null> {
    const collab = await this.loadCollabData();
    const partnership = collab.partnerships.find(
      (p) =>
        p.status === 'active' &&
        (p.userAId === userId || p.userBId === userId) &&
        (p.userAId === userId || p.userBId === userId),
    );
    if (!partnership) return null;
    const partnerId = partnership.userAId === userId ? partnership.userBId : partnership.userAId;
    const profile = collab.profiles.find((p) => p.id === partnerId);
    if (!profile) return null;
    const privacy = collab.privacySettings.find((s) => s.userId === partnerId) ?? null;
    const conversation = await this.ensureConversation(partnership.id);
    const profileForPartner: Profile = privacy
      ? {
          ...profile,
          status: maskFocusStatus(privacy.shareLiveFocus, profile.status),
          lastSeenAt: privacy.shareLiveFocus === false ? '' : profile.lastSeenAt,
        }
      : profile;
    return { profile: profileForPartner, partnership, privacy, conversation };
  }

  async getPartnerSharedPlans(userId: string): Promise<Plan[]> {
    const partner = await this.getPartner(userId);
    if (!partner) return [];
    if (partner.privacy?.sharePlans === false) return [];
    const partnerId = partner.profile.id;
    const data = await this.loadAppData();
    return data.plans.filter(
      (p) =>
        p.planType !== 'common' &&
        p.visibility === 'partner_shared' &&
        (p.ownerId === partnerId || (p.ownerId === undefined && partnerId !== DEMO_USER_ID) || partnerId === DEMO_USER_ID),
    );
  }

  async getPartnerStatistics(userId: string): Promise<PartnerStatistics | null> {
    const partner = await this.getPartner(userId);
    if (!partner) return null;
    const privacy = partner.privacy;
    if (!privacy || !privacy.shareWeeklyStats) {
      return {
        privacyEnabled: false,
        focusMinutesToday: 0,
        focusMinutesThisWeek: 0,
        completedSessions: 0,
        currentStreak: 0,
        weeklyChange: 0,
        weeklyChangeDisplay: '0%',
        recentActivity: [],
      };
    }
    const sessions = await this.sessionsForUser(partner.profile.id);
    const completed = countSessionsByStatus(sessions, SESSION_STATUS.COMPLETED);
    const todayIso = toIsoDate(new Date());
    const todayMinutes = sessions
      .filter((s) => s.date === todayIso)
      .reduce((acc, s) => acc + parseDuration(s.duration).totalMinutes, 0);
    const week = focusMinutesThisWeek(sessions);
    const { change, display } = calculateWeeklyChange(sessions);
    const grouped = groupSessionsByDate(sessions);
    const recentActivity = Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 7)
      .flatMap((date) =>
        grouped[date].map((s) => ({
          date,
          task: s.task,
          minutes: parseDuration(s.duration).totalMinutes,
        })),
      );

    return {
      privacyEnabled: true,
      focusMinutesToday: todayMinutes,
      focusMinutesThisWeek: week,
      completedSessions: completed,
      currentStreak: privacy.shareStreak ? calculateStreak(sessions) : 0,
      weeklyChange: privacy.shareStreak ? change : 0,
      weeklyChangeDisplay: privacy.shareStreak ? display : '0%',
      recentActivity: privacy.shareStreak ? recentActivity : [],
    };
  }

  async getPartnerOverview(userId: string): Promise<PartnerOverview | null> {
    const partner = await this.getPartner(userId);
    if (!partner) return null;
    const [sharedPlans, statistics] = await Promise.all([
      this.getPartnerSharedPlans(userId),
      this.getPartnerStatistics(userId),
    ]);
    return {
      ...partner,
      sharedPlans,
      statistics:
        statistics ?? {
          privacyEnabled: false,
          focusMinutesToday: 0,
          focusMinutesThisWeek: 0,
          completedSessions: 0,
          currentStreak: 0,
          weeklyChange: 0,
          weeklyChangeDisplay: '0%',
          recentActivity: [],
        },
    };
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const collab = await this.loadCollabData();
    return collab.profiles.find((p) => p.id === userId) ?? null;
  }

  // ---- Partner privacy -----------------------------------------------------

  async getPrivacySettings(userId: string): Promise<PartnerPrivacySettings> {
    const collab = await this.loadCollabData();
    const existing = collab.privacySettings.find((s) => s.userId === userId);
    return existing ? { ...existing, shareSnapshots: existing.shareSnapshots ?? true } : { userId, ...DEFAULT_PARTNER_PRIVACY };
  }

  async updatePrivacySettings(userId: string, updates: Partial<PartnerPrivacySettings>): Promise<PartnerPrivacySettings> {
    const collab = await this.loadCollabData();
    const existing = collab.privacySettings.find((s) => s.userId === userId) ?? { userId, ...DEFAULT_PARTNER_PRIVACY };
    const next: PartnerPrivacySettings = { ...existing, ...pickPrivacyFields(updates) };
    const index = collab.privacySettings.findIndex((s) => s.userId === userId);
    if (index === -1) collab.privacySettings.push(next);
    else collab.privacySettings[index] = next;
    await this.saveCollabData(collab);
    return next;
  }

  async getMaskedStatus(userId: string, status: UserStatus): Promise<UserStatus> {
    const collab = await this.loadCollabData();
    const privacy = collab.privacySettings.find((s) => s.userId === userId);
    return maskFocusStatus(privacy?.shareLiveFocus, status);
  }

  async getMaskedPresence(userId: string, status: UserStatus): Promise<{ status: UserStatus; lastSeenAt: string }> {
    const collab = await this.loadCollabData();
    const privacy = collab.privacySettings.find((s) => s.userId === userId);
    const profile = collab.profiles.find((p) => p.id === userId);
    return {
      status: maskFocusStatus(privacy?.shareLiveFocus, status),
      lastSeenAt: privacy?.shareLiveFocus === false ? '' : (profile?.lastSeenAt ?? new Date().toISOString()),
    };
  }

  private async sessionsForUser(_userId: string): Promise<Session[]> {
    const data = await this.loadAppData();
    return data.sessions;
  }

  // ---- Conversation / Chat ------------------------------------------------

  async getConversation(userId: string, partnerId: string): Promise<Conversation> {
    const collab = await this.loadCollabData();
    const partnership = collab.partnerships.find(
      (p) =>
        p.status === 'active' &&
        ((p.userAId === userId && p.userBId === partnerId) || (p.userAId === partnerId && p.userBId === userId)),
    );
    if (!partnership) throw new Error('No active partnership with this partner.');
    return this.ensureConversation(partnership.id);
  }

  async listMessages(userId: string, conversationId: string, cursor?: string, limit = 50): Promise<import('@/src/types/collaboration').Message[]> {
    const collab = await this.loadCollabData();
    const conversation = collab.conversations.find((c) => c.id === conversationId);
    if (!conversation) return [];
    const isMember = await this.isConversationMember(conversation, userId);
    if (!isMember) return [];
    let messages = collab.messages.filter((m) => m.conversationId === conversationId);
    if (cursor) messages = messages.filter((m) => m.createdAt < cursor);
    const sorted = messages
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
    return deriveReadState(sorted, conversation.readState, userId);
  }

  // ---- Paged history (Phase 11) -------------------------------------------

  async listMessagesPaged(userId: string, conversationId: string, cursor?: string, limit = 40): Promise<MessagePage> {
    const collab = await this.loadCollabData();
    const conversation = collab.conversations.find((c) => c.id === conversationId);
    if (!conversation) return { items: [], hasOlder: false, nextCursor: null };
    const isMember = await this.isConversationMember(conversation, userId);
    if (!isMember) return { items: [], hasOlder: false, nextCursor: null };
    const pageSize = Math.max(1, Math.min(200, Math.round(limit)));
    let messages = collab.messages.filter((m) => m.conversationId === conversationId);
    if (cursor) messages = messages.filter((m) => messageBeforeCursor(m, cursor));
    const sorted = [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, pageSize + 1);
    const page = buildMessagePage(sorted, pageSize);
    return { ...page, items: deriveReadState(page.items, conversation.readState, userId) };
  }

  async listSharedActivity(userId: string, cursor?: string, limit = 10): Promise<ActivityPage> {
    const collab = await this.loadCollabData();
    const partnership = collab.partnerships.find(
      (p) => p.status === 'active' && (p.userAId === userId || p.userBId === userId),
    );
    if (!partnership) return { items: [], hasMore: false, nextCursor: null };
    const pageSize = Math.max(1, Math.min(100, Math.round(limit)));
    const items: SharedActivityItem[] = collab.sharedFocusSessions
      .filter((s) => s.partnershipId === partnership.id && s.status === 'ended')
      .map((s) => ({
        id: s.id,
        type: 'shared_focus' as const,
        title: 'Shared focus session',
        subtitle: `${s.durationMinutes} min session with your partner`,
        minutes: s.durationMinutes,
        status: 'ended',
        createdAt: s.createdAt,
      }));
    const filtered = cursor ? items.filter((i) => activityBeforeCursor(i, cursor)) : items;
    return buildActivityPage([...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), pageSize);
  }

  async listPlansPaged(userId: string, cursor?: string, limit = 20): Promise<PlanPage> {
    const data = await this.loadAppData();
    const pageSize = Math.max(1, Math.min(100, Math.round(limit)));
    const filtered = cursor ? data.plans.filter((p) => planBeforeCursor(p, cursor)) : data.plans;
    return buildPlanPage(sortPlansNewestFirst(filtered), pageSize);
  }

  // ---- Shared snapshots (Phase 13) -----------------------------------------

  async listSnapshots(userId: string, conversationId: string, cursor?: string, limit = 12): Promise<SnapshotPage> {
    const collab = await this.loadCollabData();
    const conversation = collab.conversations.find((c) => c.id === conversationId);
    if (!conversation || !(await this.isConversationMember(conversation, userId))) {
      return { items: [], hasMore: false, nextCursor: null };
    }
    const pageSize = Math.max(1, Math.min(100, Math.round(limit)));
    let messages = collab.messages.filter((m) => m.conversationId === conversationId && m.type === 'image');
    if (cursor) messages = messages.filter((m) => m.createdAt < cursor);
    const sorted = messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, pageSize + 1);
    const hasMore = sorted.length > pageSize;
    const items = sorted.slice(0, pageSize).map((m) => {
      const meta = m.mediaId ? collab.mediaMeta[m.mediaId] : undefined;
      const profile = collab.profiles.find((p) => p.id === m.senderId);
      return {
        id: m.id,
        messageId: m.id,
        conversationId,
        senderId: m.senderId,
        senderName: profile?.displayName ?? 'Partner',
        caption: m.body ?? null,
        mediaId: m.mediaId ?? '',
        fileName: meta?.fileName ?? 'snapshot.png',
        mimeType: meta?.mimeType ?? m.mediaMime ?? 'image/png',
        size: meta?.size ?? m.mediaSize ?? 0,
        status: (meta?.status ?? m.mediaStatus ?? 'active') as 'active' | 'exported_and_removed',
        exported: meta?.status === 'exported_and_removed',
        createdAt: m.createdAt,
        url: '',
      };
    });
    const last = items[items.length - 1];
    return { items, hasMore, nextCursor: hasMore && last ? last.createdAt : null };
  }

  async saveSnapshot(_userId: string, _conversationId: string, _input: SnapshotSaveInput): Promise<Message> {
    throw new Error('Snapshots require MongoDB mode. Enable NEXT_PUBLIC_MONGODB_ENABLED to share snapshots.');
  }

  async exportSnapshots(_userId: string, _conversationId: string, _messageIds: string[]): Promise<ZipExportResult> {
    throw new Error('Snapshot export requires MongoDB mode.');
  }

  async removeSnapshotsAfterExport(_userId: string, _conversationId: string, _messageIds: string[]): Promise<SnapshotRemoveResult> {
    throw new Error('Snapshot removal requires MongoDB mode.');
  }

  async sendMessage(userId: string, conversationId: string, input: SendMessageInput): Promise<import('@/src/types/collaboration').Message> {
    const collab = await this.loadCollabData();
    const conversation = collab.conversations.find((c) => c.id === conversationId);
    if (!conversation) throw new Error('Conversation not found.');
    const isMember = await this.isConversationMember(conversation, userId);
    if (!isMember) throw new Error('You are not a member of this conversation.');
    const message: import('@/src/types/collaboration').Message = {
      id: crypto.randomUUID(),
      conversationId,
      senderId: userId,
      type: input.type as import('@/src/types/collaboration').MessageType,
      body: input.body ?? null,
      mediaId: input.mediaId ?? null,
      mediaMime: input.mediaMime ?? null,
      mediaSize: input.mediaSize ?? null,
      planId: input.planId ?? null,
      sharedFocusId: input.sharedFocusId ?? null,
      createdAt: new Date().toISOString(),
    };
    collab.messages.push(message);
    await this.saveCollabData(collab);
    return message;
  }

  async markRead(userId: string, conversationId: string): Promise<boolean> {
    const collab = await this.loadCollabData();
    const conversation = collab.conversations.find((c) => c.id === conversationId);
    if (!conversation) return false;
    const isMember = await this.isConversationMember(conversation, userId);
    if (!isMember) return false;
    conversation.readState = { ...conversation.readState, [userId]: new Date().toISOString() };
    await this.saveCollabData(collab);
    return true;
  }

  async sendTyping(_userId: string, _conversationId: string): Promise<boolean> {
    return false;
  }

  private async isConversationMember(conversation: Conversation, userId: string): Promise<boolean> {
    const collab = await this.loadCollabData();
    const partnership = collab.partnerships.find((p) => p.id === conversation.partnershipId);
    return Boolean(partnership && (partnership.userAId === userId || partnership.userBId === userId));
  }

  // ---- Collaboration state ------------------------------------------------

  async loadCollabData(): Promise<CollabData> {
    return collabService.loadData();
  }

  async saveCollabData(data: CollabData): Promise<boolean> {
    const ok = await collabService.saveData(data);
    return ok;
  }

  async ensureConversation(partnershipId: string): Promise<Conversation> {
    const collab = await this.loadCollabData();
    const existing = collab.conversations.find((c) => c.partnershipId === partnershipId);
    if (existing) return existing;
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      partnershipId,
      createdAt: new Date().toISOString(),
    };
    collab.conversations.push(conversation);
    await this.saveCollabData(collab);
    return conversation;
  }

  // ---- Media metadata -----------------------------------------------------

  async saveMedia(meta: MediaMeta): Promise<MediaMeta> {
    const collab = await this.loadCollabData();
    collab.mediaMeta[meta.id] = meta;
    await this.saveCollabData(collab);
    return meta;
  }

  async getMedia(mediaId: string): Promise<MediaMeta | null> {
    const collab = await this.loadCollabData();
    return collab.mediaMeta[mediaId] ?? null;
  }

  async updateMedia(mediaId: string, patch: Partial<MediaMeta>): Promise<MediaMeta | null> {
    const collab = await this.loadCollabData();
    const existing = collab.mediaMeta[mediaId];
    if (!existing) return null;
    collab.mediaMeta[mediaId] = { ...existing, ...patch };
    await this.saveCollabData(collab);
    return collab.mediaMeta[mediaId];
  }

  // ---- Realtime -----------------------------------------------------------

  subscribe(_room: string, handlers: RealtimeHandlers): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LOCAL_REALTIME_EVENT) return;
      if (handlers.onMessage && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue) as { type?: string; message?: import('@/src/types/collaboration').Message };
          if (payload.type === 'message' && payload.message) handlers.onMessage(payload.message);
        } catch {
          // ignore malformed broadcast
        }
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    };
  }

  private buildPlan(userId: string, input: PlanInput, planType: 'personal' | 'common'): Plan {
    const status: PlanStatus =
      (input.status as PlanStatus) ?? (planType === 'common' ? PLAN_STATUS.NOT_STARTED : PLAN_STATUS.NOT_STARTED);
    return {
      id: Date.now(),
      title: input.title,
      description: input.description,
      type: (input.type as Plan['type']) ?? 'weekly',
      status,
      date: input.date ?? toIsoDate(new Date()),
      priority: (input.priority as Plan['priority']) ?? 'medium',
      category: input.category,
      file: input.file ?? null,
      planType,
      visibility: planType === 'personal' ? PLAN_VISIBILITY.PRIVATE : undefined,
      ownerId: userId,
      memberRole: 'owner',
      updatedAt: new Date().toISOString(),
    };
  }
}

export function getDefaultCollab(): CollabData {
  return getDefaultCollabData();
}

export const LocalProductivityRepository = LocalJsonProductivityRepository;
