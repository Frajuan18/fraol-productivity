import '@/lib/server-only';
import { RepositoryError } from '@/lib/repositories/errors';
import { computeAnalyticsForUser, computeAnalyticsIfStale } from '@/lib/analytics/service';
import type { AnalyticsResult } from '@/lib/analytics/types';
import { assertNotStale } from '@/lib/repositories/planConcurrency';
import { getGridFSBucket, isMongoConfigured, GRIDFS_BUCKET_NAME } from '@/lib/mongodb/connection';
import { createRealDbPort, type DbPort } from '@/lib/mongodb/dataAccess';
import type { Document } from 'mongodb';
import { COLLECTIONS } from '@/lib/mongodb/collections';
import type {
  ConversationDoc,
  FocusSessionDoc,
  ImageMetadataDoc,
  MessageDoc,
  PartnershipDoc,
  PlanDoc,
  PlanMemberDoc,
  PrivacyDoc,
  ProfileDoc,
  SharedFocusDoc,
  StatsDoc,
  UserDoc,
  DashboardLayoutDoc,
} from '@/lib/mongodb/types';
import {
  MESSAGE_TYPE,
  PLAN_KIND,
  PLAN_VISIBILITY,
  type ActivityPage,
  type CollabData,
  type Conversation,
  type MediaMeta,
  type Message,
  type MessagePage,
  type PlanPage,
  type PlanVisibility,
  type Profile,
  type SharedActivityItem,
  type SharedFocusParticipant,
  type SharedFocusSession,
  type SnapshotItem,
  type SnapshotPage,
  type SnapshotRemoveResult,
  type UserStatus,
  type ZipExportResult,
} from '@/src/types/collaboration';
import { broadcastPartnership, setActiveSession } from '@/lib/realtime/hub';
import { actualFocusMs, settlePause } from '@/lib/repositories/sharedFocusMath';
import { deriveReadState } from '@/lib/realtime/readState';
import { hasShareSnapshots, hasShareStats, hasShareStreak, maskFocusStatus } from '@/lib/repositories/privacyMath';
import { buildSessionPage } from '@/lib/repositories/sessionPaging';
import { buildMessagePage } from '@/lib/repositories/chatPaging';
import { buildActivityPage } from '@/lib/repositories/activityMath';
import { buildPlanPage } from '@/lib/repositories/planPaging';
import { createZip, type ZipFileInput } from '@/lib/zip/createZip';
import { getDefaultCollabData } from '@/src/validators/collaboration';
import {
  calculateStreak,
  calculateSuccessRate,
  calculateWeeklyChange,
  countSessionsByStatus,
  focusMinutesThisWeek,
  groupSessionsByDate,
} from '@/src/utils/statistics';
import { parseDuration } from '@/src/utils/time';
import {
  SESSION_STATUS,
  PLAN_STATUS,
  type AppData,
  type Plan,
  type PlanStatus,
  type Session,
  type Stats,
} from '@/src/types';
import type {
  AuthUser,
  PartnerOverview,
  PartnerStatistics,
  PartnerView,
  PlanInput,
  ProductivityRepository,
  RepositoryMode,
  SendMessageInput,
  SessionInput,
  SessionPage,
} from '@/lib/repositories/ProductivityRepository';
import { SESSION_PAGE_SIZE, DEFAULT_PARTNER_PRIVACY } from '@/lib/repositories/ProductivityRepository';
import type { PartnerPrivacySettings } from '@/src/types/collaboration';

function nowIso(): string {
  return new Date().toISOString();
}

/** Normalises BSON Binary / Buffer / Uint8Array into a plain Uint8Array. */
function binaryToBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  const candidate = value as { buffer?: Uint8Array; value?: () => Uint8Array; _bsontype?: string };
  if (candidate.buffer instanceof Uint8Array) {
    const buf = candidate.buffer;
    return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  if (typeof candidate.value === 'function') return candidate.value();
  return new Uint8Array();
}

const PRIVACY_FIELDS = ['shareWeeklyStats', 'shareStreak', 'sharePlans', 'shareLiveFocus', 'shareSnapshots'] as const;

function pickPrivacyUpdates(updates: Partial<PartnerPrivacySettings>): Partial<PartnerPrivacySettings> {
  const picked: Partial<PartnerPrivacySettings> = {};
  for (const key of PRIVACY_FIELDS) {
    if (typeof updates[key] === 'boolean') picked[key] = updates[key];
  }
  return picked;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function planDocToPlan(doc: PlanDoc): Plan {
  return {
    id: doc._id,
    title: doc.title,
    description: doc.description,
    type: doc.type,
    status: doc.status,
    date: doc.date,
    priority: doc.priority,
    category: doc.category,
    file: doc.file ?? null,
    planType: doc.planType,
    visibility: doc.visibility,
    ownerId: doc.ownerId,
    memberCount: doc.memberCount,
    updatedAt: doc.updatedAt,
  };
}

function focusDocToSession(doc: FocusSessionDoc): Session {
  return {
    id: Number(doc._id) || doc.legacyId || 0,
    task: doc.task,
    duration: doc.duration,
    date: doc.date,
    status: doc.status as Session['status'],
    startTime: doc.startTime,
    endTime: doc.endTime,
    actualDuration: doc.actualDuration,
    createdAt: doc.createdAt,
  };
}

function messageDocToMessage(doc: MessageDoc): Message {
  return {
    id: doc._id,
    conversationId: doc.conversationId,
    senderId: doc.senderId,
    type: doc.type as Message['type'],
    body: doc.body ?? null,
    mediaId: doc.mediaId ?? null,
    mediaMime: doc.mediaMime ?? null,
    mediaSize: doc.mediaSize ?? null,
    mediaStatus: doc.mediaStatus,
    planId: doc.planId ?? null,
    sharedFocusId: doc.sharedFocusId ?? null,
    readAt: doc.readAt ?? null,
    createdAt: doc.createdAt,
  };
}

function sharedFocusDocToSession(doc: SharedFocusDoc): SharedFocusSession {
  return {
    id: doc._id,
    partnershipId: doc.partnershipId,
    status: doc.status,
    durationMinutes: doc.durationMinutes,
    startedAt: doc.startedAt,
    pausedAt: doc.pausedAt,
    totalPausedMs: doc.totalPausedMs,
    endsAt: doc.endsAt,
    createdBy: doc.createdBy,
    participants: doc.participants,
    createdAt: doc.createdAt,
  };
}

function profileDocToProfile(doc: ProfileDoc): Profile {
  return {
    id: doc.userId,
    email: doc.email,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl ?? null,
    status: doc.status,
    lastSeenAt: doc.lastSeenAt,
  };
}

const EMPTY_STATS: Stats = {
  focusTime: '0h',
  sessions: 0,
  streak: '0 days',
  productivity: '0%',
  totalFocusHours: 0,
  weeklyStreak: 0,
  dailyStreak: 0,
};

/**
 * Production repository backed by MongoDB. Every read/write is scoped to the
 * authenticated user id passed from the server request — caller-supplied user ids are
 * never trusted for ownership decisions. Image binaries are stored in the `chatSnapshots`
 * GridFS bucket; only metadata lives in `imageMetadata`.
 */
export class MongoDbProductivityRepository implements ProductivityRepository {
  readonly mode: RepositoryMode = 'mongodb';

  constructor(private readonly db: DbPort) {}

  // ---- Identity -----------------------------------------------------------

  async getCurrentUser(): Promise<AuthUser | null> {
    // Resolved from the authenticated session by the API layer; this adapter is always
    // invoked with a validated userId via the other methods.
    return null;
  }

  // ---- Core app data (legacy compatibility) --------------------------------

  async loadAppData(userId = ''): Promise<AppData> {
    if (!userId)
      return {
        plans: [],
        sessions: [],
        stats: EMPTY_STATS,
        user: { name: '', streak: 0, totalFocusHours: 0, taskTypes: [] },
      };
    const plans = [...(await this.getMyPlans(userId)), ...(await this.getCommonPlans(userId))];
    const sessions = (await this.listSessions(userId, undefined, SESSION_PAGE_SIZE)).items;
    const stats = await this.getStatistics(userId);
    const user = await this.db
      .collection<UserDoc>(COLLECTIONS.USERS)
      .findOne({ _id: userId })
      .then((u) => u ?? null);
    return {
      plans,
      sessions,
      stats,
      user: {
        name: user?.displayName ?? 'User',
        streak: stats.weeklyStreak,
        totalFocusHours: stats.totalFocusHours,
        taskTypes: [],
      },
    };
  }

  async saveAppData(): Promise<boolean> {
    throw new Error('In MongoDB mode, write through the dedicated plan/session methods, not saveAppData.');
  }

  // ---- Plans ---------------------------------------------------------------

  async getMyPlans(userId: string): Promise<Plan[]> {
    const plans = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).find({ planType: 'personal', ownerId: userId });
    return plans.map(planDocToPlan).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  async getCommonPlans(userId: string): Promise<Plan[]> {
    const memberships = await this.db.collection<PlanMemberDoc>(COLLECTIONS.PLAN_MEMBERS).find({ userId });
    const planIds = memberships.map((m) => m.planId);
    if (planIds.length === 0) return [];
    const roleByPlan = new Map<number, PlanMemberDoc['role']>(memberships.map((m) => [m.planId, m.role]));
    const plans = await this.db
      .collection<PlanDoc>(COLLECTIONS.PLANS)
      .find({ planType: 'common', _id: { $in: planIds } });
    return plans
      .map((doc) => ({ ...planDocToPlan(doc), memberRole: roleByPlan.get(doc._id) }))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  async getPlanById(planId: number, userId: string): Promise<Plan | null> {
    const doc = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).findOne({ _id: planId });
    if (!doc) return null;
    if (doc.planType === 'common') {
      const member = await this.db.collection<PlanMemberDoc>(COLLECTIONS.PLAN_MEMBERS).findOne({ planId, userId });
      if (!member) return null;
      return { ...planDocToPlan(doc), memberRole: member.role };
    }
    if (doc.ownerId !== userId) return null;
    return planDocToPlan(doc);
  }

  async createPersonalPlan(userId: string, input: PlanInput): Promise<Plan> {
    const id = Date.now();
    const now = nowIso();
    const doc: PlanDoc = {
      _id: id,
      planType: 'personal',
      visibility: PLAN_VISIBILITY.PRIVATE,
      ownerId: userId,
      title: input.title,
      description: input.description,
      type: input.type as PlanDoc['type'],
      status: (input.status as PlanStatus) ?? PLAN_STATUS.NOT_STARTED,
      date: input.date ?? toIsoDate(new Date()),
      priority: input.priority as PlanDoc['priority'],
      category: input.category,
      file: input.file ?? null,
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).insertOne(doc);
    return planDocToPlan(doc);
  }

  async createCommonPlan(userId: string, input: PlanInput): Promise<Plan> {
    const partner = await this.getConfiguredPartner(userId);
    if (!partner) {
      throw new RepositoryError(
        'No configured partner. Run `npm run partner:seed` to set up the fixed partnership first.',
        'NO_PARTNER',
        409,
      );
    }
    const id = Date.now();
    const now = nowIso();
    const doc: PlanDoc = {
      _id: id,
      planType: 'common',
      ownerId: userId,
      title: input.title,
      description: input.description,
      type: input.type as PlanDoc['type'],
      status: (input.status as PlanStatus) ?? PLAN_STATUS.NOT_STARTED,
      date: input.date ?? toIsoDate(new Date()),
      priority: input.priority as PlanDoc['priority'],
      category: input.category,
      file: null,
      memberCount: 2,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).insertOne(doc);
    await this.db.collection<PlanMemberDoc>(COLLECTIONS.PLAN_MEMBERS).insertOne({
      _id: crypto.randomUUID(),
      planId: id,
      userId,
      role: 'owner',
      joinedAt: now,
    });
    await this.db.collection<PlanMemberDoc>(COLLECTIONS.PLAN_MEMBERS).insertOne({
      _id: crypto.randomUUID(),
      planId: id,
      userId: partner.partnerId,
      role: 'editor',
      joinedAt: now,
    });
    return { ...planDocToPlan(doc), memberRole: 'owner' };
  }

  async updatePersonalPlan(userId: string, planId: number, updates: Partial<Plan>): Promise<Plan | null> {
    const plan = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).findOne({ _id: planId });
    if (!plan || plan.planType !== 'personal' || plan.ownerId !== userId) return null;
    const update: Record<string, unknown> = { updatedAt: nowIso() };
    for (const key of [
      'title',
      'description',
      'type',
      'status',
      'date',
      'priority',
      'category',
      'file',
      'visibility',
    ] as const) {
      if (updates[key] !== undefined) update[key] = updates[key];
    }
    await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).updateOne({ _id: planId }, { $set: update });
    const updated = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).findOne({ _id: planId });
    return updated ? planDocToPlan(updated) : null;
  }

  async updateCommonPlan(
    userId: string,
    planId: number,
    updates: Partial<Plan>,
    expectedUpdatedAt?: string,
  ): Promise<Plan | null> {
    const member = await this.db.collection<PlanMemberDoc>(COLLECTIONS.PLAN_MEMBERS).findOne({ planId, userId });
    if (!member || member.role === 'viewer') return null;
    const current = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).findOne({ _id: planId });
    if (!current) return null;
    assertNotStale(current.updatedAt, expectedUpdatedAt);
    const update: Record<string, unknown> = { updatedAt: nowIso() };
    for (const key of ['title', 'description', 'type', 'status', 'date', 'priority', 'category', 'file'] as const) {
      if (updates[key] !== undefined) update[key] = updates[key];
    }
    await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).updateOne({ _id: planId }, { $set: update });
    const updated = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).findOne({ _id: planId });
    return updated ? { ...planDocToPlan(updated), memberRole: member.role } : null;
  }

  async deletePlan(userId: string, planId: number): Promise<boolean> {
    const plan = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).findOne({ _id: planId });
    if (!plan) return false;
    if (plan.planType === 'common') {
      const member = await this.db.collection<PlanMemberDoc>(COLLECTIONS.PLAN_MEMBERS).findOne({ planId, userId });
      if (!member || member.role !== 'owner') return false;
    } else if (plan.ownerId !== userId) {
      return false;
    }
    await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).deleteOne({ _id: planId });
    await this.db.collection<PlanMemberDoc>(COLLECTIONS.PLAN_MEMBERS).deleteMany({ planId });
    return true;
  }

  async changePlanVisibility(userId: string, planId: number, visibility: PlanVisibility): Promise<Plan | null> {
    const plan = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).findOne({ _id: planId });
    if (!plan || plan.planType !== 'personal' || plan.ownerId !== userId) return null;
    const allowed = visibility === 'private' || visibility === 'partner_shared';
    if (!allowed) return null;
    await this.db
      .collection<PlanDoc>(COLLECTIONS.PLANS)
      .updateOne({ _id: planId }, { $set: { visibility, updatedAt: nowIso() } });
    const updated = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).findOne({ _id: planId });
    return updated ? planDocToPlan(updated) : null;
  }

  // ---- Shared focus (realtime, server-authoritative) -----------------------

  async setUserStatus(userId: string, status: UserStatus): Promise<void> {
    await this.db
      .collection<ProfileDoc>(COLLECTIONS.PROFILES)
      .updateOne({ userId }, { $set: { status, lastSeenAt: nowIso() } }, { upsert: true });
    try {
      const configured = await this.getConfiguredPartner(userId);
      if (!configured) return;
      const masked = await this.getMaskedPresence(userId, status);
      broadcastPartnership(configured.partnership._id, {
        type: 'presence',
        userId,
        status: masked.status,
        lastSeenAt: masked.lastSeenAt,
      });
    } catch {
      // presence broadcast is best-effort — the next heartbeat/SSE frame resyncs
    }
  }

  async getActiveSharedFocus(userId: string): Promise<SharedFocusSession | null> {
    const configured = await this.getConfiguredPartner(userId);
    if (!configured) return null;
    const docs = await this.db
      .collection<SharedFocusDoc>(COLLECTIONS.SHARED_FOCUS_SESSIONS)
      .find(
        { partnershipId: configured.partnership._id, status: { $in: ['running', 'paused'] } },
        { sort: { createdAt: -1 }, limit: 1 },
      );
    const doc = docs[0];
    return doc ? sharedFocusDocToSession(doc) : null;
  }

  async startSharedFocus(userId: string, durationMinutes: number): Promise<SharedFocusSession | null> {
    const configured = await this.getConfiguredPartner(userId);
    if (!configured) return null;
    const active = await this.getActiveSharedFocus(userId);
    if (active) return active;
    const minutes = Math.max(1, Math.min(480, Math.round(durationMinutes)));
    const now = nowIso();
    const startMs = Date.now();
    const participants: SharedFocusParticipant[] = [
      { userId, ready: true, joinedAt: now, completed: false },
      { userId: configured.partnerId, ready: true, joinedAt: now, completed: false },
    ];
    const session: SharedFocusSession = {
      id: crypto.randomUUID(),
      partnershipId: configured.partnership._id,
      status: 'running',
      durationMinutes: minutes,
      startedAt: now,
      pausedAt: null,
      totalPausedMs: 0,
      endsAt: new Date(startMs + minutes * 60_000).toISOString(),
      createdBy: userId,
      participants,
      createdAt: now,
    };
    await this.db
      .collection<SharedFocusDoc>(COLLECTIONS.SHARED_FOCUS_SESSIONS)
      .insertOne({ ...session, _id: session.id });
    await this.setUserStatus(userId, 'focusing');
    await this.setUserStatus(configured.partnerId, 'focusing');
    await this.emitPresence(session.partnershipId, userId, 'focusing');
    await this.emitPresence(session.partnershipId, configured.partnerId, 'focusing');
    this.emitFocusState(session);
    return session;
  }

  async pauseSharedFocus(userId: string, sessionId: string): Promise<SharedFocusSession | null> {
    const session = await this.getSharedFocusForUser(userId, sessionId);
    if (!session || session.status !== 'running') return null;
    const updated: SharedFocusSession = { ...session, status: 'paused', pausedAt: nowIso() };
    await this.saveSharedFocus(updated);
    this.emitFocusState(updated);
    return updated;
  }

  async resumeSharedFocus(userId: string, sessionId: string): Promise<SharedFocusSession | null> {
    const session = await this.getSharedFocusForUser(userId, sessionId);
    if (!session || session.status !== 'paused') return null;
    const settled = settlePause(session, Date.now());
    const updated: SharedFocusSession = {
      ...session,
      status: 'running',
      pausedAt: null,
      totalPausedMs: settled.totalPausedMs,
      endsAt: settled.endsAt,
    };
    await this.saveSharedFocus(updated);
    this.emitFocusState(updated);
    return updated;
  }

  async completeSharedFocus(userId: string, sessionId: string): Promise<SharedFocusSession | null> {
    const session = await this.getSharedFocusForUser(userId, sessionId);
    if (!session || session.status === 'ended') return null;
    const now = nowIso();
    const nowMs = Date.now();
    const settled =
      session.status === 'paused'
        ? settlePause(session, nowMs)
        : {
            status: session.status,
            pausedAt: session.pausedAt,
            totalPausedMs: session.totalPausedMs,
            endsAt: session.endsAt,
          };
    const actualMinutes = Math.round(actualFocusMs(session.startedAt, settled.totalPausedMs, nowMs) / 60_000);
    const completed: SharedFocusSession = {
      ...session,
      status: 'ended',
      pausedAt: null,
      totalPausedMs: settled.totalPausedMs,
      participants: session.participants.map((p) => ({ ...p, completed: true })),
      endsAt: now,
    };
    await this.saveSharedFocus(completed);
    await this.recordSharedFocusSessions(completed, actualMinutes);
    await this.notifyFocusCompletion(completed, actualMinutes);
    await this.setUserStatus(userId, 'online');
    for (const participant of completed.participants) {
      if (participant.userId !== userId) await this.setUserStatus(participant.userId, 'online');
    }
    await this.emitPresence(completed.partnershipId, userId, 'online');
    for (const participant of completed.participants) {
      if (participant.userId !== userId) await this.emitPresence(completed.partnershipId, participant.userId, 'online');
    }
    this.emitFocusState(completed);
    return completed;
  }

  async cancelSharedFocus(userId: string, sessionId: string): Promise<SharedFocusSession | null> {
    const session = await this.getSharedFocusForUser(userId, sessionId);
    if (!session || session.status === 'ended') return null;
    const updated: SharedFocusSession = {
      ...session,
      status: 'ended',
      pausedAt: null,
      participants: session.participants.map((p) => ({ ...p, completed: false })),
      endsAt: nowIso(),
    };
    await this.saveSharedFocus(updated);
    await this.setUserStatus(userId, 'online');
    for (const participant of updated.participants) {
      if (participant.userId !== userId) await this.setUserStatus(participant.userId, 'online');
    }
    await this.emitPresence(updated.partnershipId, userId, 'online');
    for (const participant of updated.participants) {
      if (participant.userId !== userId) await this.emitPresence(updated.partnershipId, participant.userId, 'online');
    }
    this.emitFocusState(updated);
    return updated;
  }

  private async getSharedFocusForUser(userId: string, sessionId: string): Promise<SharedFocusSession | null> {
    const configured = await this.getConfiguredPartner(userId);
    if (!configured) return null;
    const doc = await this.db.collection<SharedFocusDoc>(COLLECTIONS.SHARED_FOCUS_SESSIONS).findOne({
      _id: sessionId,
      partnershipId: configured.partnership._id,
    });
    if (!doc) return null;
    if (!doc.participants.some((p) => p.userId === userId)) return null;
    return sharedFocusDocToSession(doc);
  }

  private async saveSharedFocus(session: SharedFocusSession): Promise<void> {
    await this.db
      .collection<SharedFocusDoc>(COLLECTIONS.SHARED_FOCUS_SESSIONS)
      .updateOne({ _id: session.id }, { $set: { ...session } });
  }

  private emitFocusState(session: SharedFocusSession): void {
    setActiveSession(session.partnershipId, session);
    broadcastPartnership(session.partnershipId, {
      type: 'focus.state',
      session,
      at: nowIso(),
    });
  }

  private async emitPresence(partnershipId: string, userId: string, status: UserStatus): Promise<void> {
    const masked = await this.getMaskedPresence(userId, status);
    broadcastPartnership(partnershipId, {
      type: 'presence',
      userId,
      status: masked.status,
      lastSeenAt: masked.lastSeenAt,
    });
  }

  private async recordSharedFocusSessions(session: SharedFocusSession, actualMinutes: number): Promise<void> {
    const input: SessionInput = {
      task: 'Shared focus',
      duration: `${actualMinutes} min`,
      date: toIsoDate(new Date()),
      status: SESSION_STATUS.COMPLETED,
      startTime: session.startedAt ?? undefined,
      endTime: session.endsAt ?? undefined,
      actualDuration: `${actualMinutes} min`,
    };
    for (const participant of session.participants) {
      await this.createSession(participant.userId, input);
    }
  }

  private async notifyFocusCompletion(session: SharedFocusSession, actualMinutes: number): Promise<void> {
    const conversation = await this.ensureConversation(session.partnershipId);
    const message: MessageDoc = {
      _id: crypto.randomUUID(),
      conversationId: conversation.id,
      senderId: session.createdBy,
      type: MESSAGE_TYPE.SYSTEM,
      body: `Completed a ${actualMinutes}-minute shared focus session together.`,
      planId: null,
      sharedFocusId: session.id,
      createdAt: nowIso(),
    };
    await this.db.collection<MessageDoc>(COLLECTIONS.MESSAGES).insertOne(message);
    broadcastPartnership(session.partnershipId, {
      type: 'chat.message',
      conversationId: conversation.id,
      message: messageDocToMessage(message),
      at: nowIso(),
    });
  }

  // ---- Sessions -----------------------------------------------------------

  async getSessions(userId: string): Promise<Session[]> {
    const docs = await this.db
      .collection<FocusSessionDoc>(COLLECTIONS.FOCUS_SESSIONS)
      .find({ userId }, { sort: { startedAt: -1 } });
    return docs.map(focusDocToSession);
  }

  async listSessions(userId: string, cursor?: string, limit = 60): Promise<SessionPage> {
    const pageSize = Math.max(1, Math.min(200, Math.round(limit)));
    const filter: Record<string, unknown> = { userId };
    if (cursor) filter.createdAt = { $lt: cursor };
    const docs = await this.db
      .collection<FocusSessionDoc>(COLLECTIONS.FOCUS_SESSIONS)
      .find(filter, { sort: { createdAt: -1 }, limit: pageSize + 1 });
    return buildSessionPage(docs.map(focusDocToSession), pageSize);
  }

  async createSession(userId: string, input: SessionInput): Promise<Session> {
    const now = nowIso();
    const doc: FocusSessionDoc = {
      _id: crypto.randomUUID(),
      userId,
      task: input.task,
      duration: input.duration,
      durationMinutes: parseDuration(input.duration).totalMinutes,
      date: input.date,
      status: input.status ?? SESSION_STATUS.COMPLETED,
      startTime: input.startTime,
      endTime: input.endTime,
      actualDuration: input.actualDuration,
      startedAt: input.startTime ? toIsoDate(new Date()) : undefined,
      createdAt: now,
    };
    await this.db.collection<FocusSessionDoc>(COLLECTIONS.FOCUS_SESSIONS).insertOne(doc);
    await this.upsertDailyStats(userId, doc);
    return focusDocToSession(doc);
  }

  private async upsertDailyStats(userId: string, doc: FocusSessionDoc): Promise<void> {
    const isCompleted = doc.status === SESSION_STATUS.COMPLETED;
    const date = doc.date.length > 10 ? doc.date.slice(0, 10) : doc.date;
    const minutes = isCompleted ? doc.durationMinutes : 0;
    await this.db.collection<StatsDoc>(COLLECTIONS.STATISTICS).updateOne(
      { userId, date },
      {
        $inc: { focusMinutes: minutes, sessionsCompleted: isCompleted ? 1 : 0 },
        $set: { updatedAt: nowIso() },
      },
      { upsert: true },
    );
  }

  // ---- Statistics ---------------------------------------------------------

  async getStatistics(userId: string): Promise<Stats> {
    const docs = await this.db.collection<FocusSessionDoc>(COLLECTIONS.FOCUS_SESSIONS).find({ userId });
    const sessions = docs.map(focusDocToSession);
    const completed = countSessionsByStatus(sessions, SESSION_STATUS.COMPLETED);
    const totalMinutes = sessions.reduce((acc, s) => acc + parseDuration(s.duration).totalMinutes, 0);
    const successRate = calculateSuccessRate(sessions);
    const streak = calculateStreak(sessions);
    const hours = Math.floor(totalMinutes / 60);
    return {
      focusTime: `${hours}h`,
      sessions: completed,
      streak: `${streak} days`,
      productivity: `${successRate}%`,
      totalFocusHours: hours,
      weeklyStreak: streak,
      dailyStreak: 0,
    };
  }

  // ---- Productivity analytics (Phase 16) -----------------------------------

  async getAnalytics(userId: string): Promise<AnalyticsResult> {
    return computeAnalyticsIfStale(userId);
  }

  async refreshAnalytics(userId: string): Promise<AnalyticsResult> {
    return computeAnalyticsForUser(userId);
  }

  // ---- Smart planning assistant (Phase 17) -----------------------------------

  async getPlanningSignals(userId: string): Promise<import('@/lib/assistant/types').HistorySignals> {
    // Use a short time budget: the assistant only needs signals, which are derived from
    // the user's own plans and sessions — no raw history is exposed.
    const [sessions, plans] = await Promise.all([this.getSessions(userId), this.getMyPlans(userId)]);
    const { computeHistorySignals } = await import('@/lib/assistant/signals');
    return computeHistorySignals(sessions, plans);
  }

  // ---- Customizable dashboard layout (Phase 18) ------------------------------------

  async getDashboardLayout(userId: string): Promise<import('@/lib/dashboard/types').DashboardLayout> {
    const { normalizeLayout } = await import('@/lib/dashboard/layout');
    const doc = await this.db.collection<DashboardLayoutDoc>(COLLECTIONS.DASHBOARD_LAYOUTS).findOne({ userId });
    return normalizeLayout(doc?.layout);
  }

  async saveDashboardLayout(userId: string, layout: import('@/lib/dashboard/types').DashboardLayout): Promise<boolean> {
    const { normalizeLayout } = await import('@/lib/dashboard/layout');
    const normalized = normalizeLayout(layout);
    return this.db
      .collection<DashboardLayoutDoc>(COLLECTIONS.DASHBOARD_LAYOUTS)
      .updateOne(
        { userId },
        { $set: { userId, layout: normalized, updatedAt: nowIso() }, $setOnInsert: { _id: userId } },
        { upsert: true },
      );
  }

  // ---- Partner ------------------------------------------------------------

  async getPartner(userId: string): Promise<PartnerView | null> {
    const configured = await this.getConfiguredPartner(userId);
    if (!configured) return null;
    const { partnership, partnerId } = configured;
    const profileDoc = await this.db.collection<ProfileDoc>(COLLECTIONS.PROFILES).findOne({ userId: partnerId });
    if (!profileDoc) return null;
    const privacy = await this.db
      .collection<PrivacyDoc>(COLLECTIONS.PARTNER_PRIVACY_SETTINGS)
      .findOne({ userId: partnerId });
    const conversation = await this.ensureConversation(partnership._id);
    const rawProfile = profileDocToProfile(profileDoc);
    // "Last active" is presence detail: it is only exposed when live-focus sharing is on.
    const maskedLastSeen = privacy?.shareLiveFocus === false ? '' : rawProfile.lastSeenAt;
    const profile: Profile = privacy
      ? {
          ...rawProfile,
          status: maskFocusStatus(privacy.shareLiveFocus, rawProfile.status),
          lastSeenAt: maskedLastSeen,
        }
      : rawProfile;
    return {
      profile,
      partnership: {
        id: partnership._id,
        userAId: partnership.userAId,
        userBId: partnership.userBId,
        status: partnership.status,
        relationshipType: partnership.relationshipType,
        invitedBy: partnership.invitedBy,
        createdAt: partnership.createdAt,
        updatedAt: partnership.updatedAt,
      },
      privacy: privacy
        ? {
            userId: privacy.userId,
            shareWeeklyStats: privacy.shareWeeklyStats,
            shareStreak: privacy.shareStreak,
            sharePlans: privacy.sharePlans,
            shareLiveFocus: privacy.shareLiveFocus,
            shareSnapshots: privacy.shareSnapshots ?? true,
          }
        : null,
      conversation,
    };
  }

  async getPartnerSharedPlans(userId: string): Promise<Plan[]> {
    const configured = await this.getConfiguredPartner(userId);
    if (!configured) return [];
    const privacy = await this.db
      .collection<PrivacyDoc>(COLLECTIONS.PARTNER_PRIVACY_SETTINGS)
      .findOne({ userId: configured.partnerId });
    if (privacy?.sharePlans === false) return [];
    const plans = await this.db
      .collection<PlanDoc>(COLLECTIONS.PLANS)
      .find({ planType: 'personal', ownerId: configured.partnerId, visibility: 'partner_shared' });
    return plans.map(planDocToPlan).sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }

  async getPartnerStatistics(userId: string): Promise<PartnerStatistics | null> {
    const configured = await this.getConfiguredPartner(userId);
    if (!configured) return null;
    const partnerId = configured.partnerId;
    const privacy = await this.db
      .collection<PrivacyDoc>(COLLECTIONS.PARTNER_PRIVACY_SETTINGS)
      .findOne({ userId: partnerId });
    const shareStats = hasShareStats(privacy);
    const shareStreak = hasShareStreak(privacy);

    if (!shareStats) {
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

    const docs = await this.db.collection<FocusSessionDoc>(COLLECTIONS.FOCUS_SESSIONS).find({ userId: partnerId });
    const sessions = docs.map(focusDocToSession);
    const todayIso = toIsoDate(new Date());
    const todayMinutes = sessions
      .filter((s) => s.date === todayIso)
      .reduce((acc, s) => acc + parseDuration(s.duration).totalMinutes, 0);
    const week = focusMinutesThisWeek(sessions);
    const completed = countSessionsByStatus(sessions, SESSION_STATUS.COMPLETED);
    const { change, display } = calculateWeeklyChange(sessions);
    const grouped = groupSessionsByDate(sessions);
    const recentActivity = shareStreak
      ? Object.keys(grouped)
          .sort((a, b) => b.localeCompare(a))
          .slice(0, 7)
          .flatMap((date) =>
            grouped[date].map((s) => ({ date, task: s.task, minutes: parseDuration(s.duration).totalMinutes })),
          )
      : [];

    return {
      privacyEnabled: true,
      focusMinutesToday: todayMinutes,
      focusMinutesThisWeek: week,
      completedSessions: completed,
      currentStreak: shareStreak ? calculateStreak(sessions) : 0,
      weeklyChange: shareStreak ? change : 0,
      weeklyChangeDisplay: shareStreak ? display : '0%',
      recentActivity,
    };
  }

  async getPartnerOverview(userId: string): Promise<PartnerOverview | null> {
    const configured = await this.getConfiguredPartner(userId);
    if (!configured) return null;
    const view = await this.getPartner(userId);
    if (!view) return null;
    const [sharedPlans, statistics] = await Promise.all([
      this.getPartnerSharedPlans(userId),
      this.getPartnerStatistics(userId),
    ]);
    return {
      ...view,
      sharedPlans,
      statistics: statistics ?? {
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
    const doc = await this.db.collection<ProfileDoc>(COLLECTIONS.PROFILES).findOne({ userId });
    return doc ? profileDocToProfile(doc) : null;
  }

  // ---- Partner privacy -----------------------------------------------------

  async getPrivacySettings(userId: string): Promise<PartnerPrivacySettings> {
    const doc = await this.db.collection<PrivacyDoc>(COLLECTIONS.PARTNER_PRIVACY_SETTINGS).findOne({ userId });
    return doc
      ? {
          userId: doc.userId,
          shareWeeklyStats: doc.shareWeeklyStats,
          shareStreak: doc.shareStreak,
          sharePlans: doc.sharePlans,
          shareLiveFocus: doc.shareLiveFocus,
          shareSnapshots: doc.shareSnapshots ?? true,
        }
      : { userId, ...DEFAULT_PARTNER_PRIVACY };
  }

  async updatePrivacySettings(
    userId: string,
    updates: Partial<PartnerPrivacySettings>,
  ): Promise<PartnerPrivacySettings> {
    const configured = await this.getConfiguredPartner(userId);
    const existing = await this.getPrivacySettings(userId);
    const next: PartnerPrivacySettings = { ...existing, ...pickPrivacyUpdates(updates) };
    await this.db
      .collection<PrivacyDoc>(COLLECTIONS.PARTNER_PRIVACY_SETTINGS)
      .updateOne({ userId }, { $set: { ...next, updatedAt: nowIso() } }, { upsert: true });
    if (configured) {
      if (next.shareLiveFocus !== existing.shareLiveFocus) {
        // Push a corrected presence so the partner stops seeing "focusing" immediately —
        // protected state must never linger in the partner UI after the setting changes.
        const profile = await this.db.collection<ProfileDoc>(COLLECTIONS.PROFILES).findOne({ userId });
        if (profile) await this.emitPresence(configured.partnership._id, userId, profile.status);
      }
      broadcastPartnership(configured.partnership._id, {
        type: 'privacy.changed',
        userId,
        at: nowIso(),
      });
    }
    return next;
  }

  async getMaskedStatus(userId: string, status: UserStatus): Promise<UserStatus> {
    const privacy = await this.db.collection<PrivacyDoc>(COLLECTIONS.PARTNER_PRIVACY_SETTINGS).findOne({ userId });
    return maskFocusStatus(privacy?.shareLiveFocus, status);
  }

  async getMaskedPresence(userId: string, status: UserStatus): Promise<{ status: UserStatus; lastSeenAt: string }> {
    const [privacy, profile] = await Promise.all([
      this.db.collection<PrivacyDoc>(COLLECTIONS.PARTNER_PRIVACY_SETTINGS).findOne({ userId }),
      this.db.collection<ProfileDoc>(COLLECTIONS.PROFILES).findOne({ userId }),
    ]);
    return {
      status: maskFocusStatus(privacy?.shareLiveFocus, status),
      lastSeenAt: privacy?.shareLiveFocus === false ? '' : (profile?.lastSeenAt ?? nowIso()),
    };
  }

  /**
   * Resolves the preconfigured partner for the authenticated user. The partner id is never
   * supplied by the client — it is derived from the single active partnership the user
   * belongs to. A `fixed_partner` relationship (the seeded production configuration) is
   * preferred; any other active record is honoured only as a legacy/dev fallback.
   */
  private async getConfiguredPartner(
    userId: string,
  ): Promise<{ partnership: PartnershipDoc; partnerId: string } | null> {
    const partnership = await this.findActivePartnership(userId);
    if (!partnership) return null;
    const partnerId = partnership.userAId === userId ? partnership.userBId : partnership.userAId;
    return { partnership, partnerId };
  }

  private async findActivePartnership(userId: string): Promise<PartnershipDoc | null> {
    const partnerships = await this.db.collection<PartnershipDoc>(COLLECTIONS.PARTNERSHIPS).find({
      status: 'active',
      $or: [{ userAId: userId }, { userBId: userId }],
    });
    if (partnerships.length === 0) return null;

    const users = this.db.collection<UserDoc>(COLLECTIONS.USERS);
    const candidates = partnerships.filter((p) => p.relationshipType === 'fixed_partner') ?? partnerships;

    for (const p of candidates) {
      const partnerId = p.userAId === userId ? p.userBId : p.userAId;
      const partnerExists = await users.findOne({ _id: partnerId });
      if (partnerExists) return p;
    }

    // Clean up orphaned partnerships where the partner user no longer exists.
    for (const p of partnerships) {
      const partnerId = p.userAId === userId ? p.userBId : p.userAId;
      const partnerExists = await users.findOne({ _id: partnerId });
      if (!partnerExists) {
        await this.db.collection<PartnershipDoc>(COLLECTIONS.PARTNERSHIPS).deleteOne({ _id: p._id });
      }
    }

    return null;
  }

  // ---- Conversation / Chat ------------------------------------------------

  async ensureConversation(partnershipId: string): Promise<Conversation> {
    const existing = await this.db.collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS).findOne({ partnershipId });
    if (existing) {
      return { id: existing._id, partnershipId: existing.partnershipId, createdAt: existing.createdAt };
    }
    const partnership = await this.db
      .collection<PartnershipDoc>(COLLECTIONS.PARTNERSHIPS)
      .findOne({ _id: partnershipId });
    if (!partnership) throw new Error('Partnership not found.');
    const conversation: ConversationDoc = {
      _id: crypto.randomUUID(),
      partnershipId,
      memberIds: [partnership.userAId, partnership.userBId],
      createdAt: nowIso(),
    };
    await this.db.collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS).insertOne(conversation);
    return { id: conversation._id, partnershipId: conversation.partnershipId, createdAt: conversation.createdAt };
  }

  async getConversation(userId: string, partnerId: string): Promise<Conversation> {
    const partnership = await this.findActivePartnership(userId);
    if (!partnership) throw new Error('No active partnership with this partner.');
    const partnerIsMember = partnership.userAId === partnerId || partnership.userBId === partnerId;
    if (!partnerIsMember) throw new Error('No active partnership with this partner.');
    return this.ensureConversation(partnership._id);
  }

  async listMessages(userId: string, conversationId: string, cursor?: string, limit = 50): Promise<Message[]> {
    const conversation = await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .findOne({ _id: conversationId });
    if (!conversation || !conversation.memberIds.includes(userId)) return [];
    const filter: Record<string, unknown> = { conversationId };
    if (cursor) filter.createdAt = { $lt: cursor };
    const docs = await this.db
      .collection<MessageDoc>(COLLECTIONS.MESSAGES)
      .find(filter, { sort: { createdAt: -1 }, limit });
    return deriveReadState(docs.map(messageDocToMessage), conversation.readState, userId);
  }

  // ---- Paged history (Phase 11) -------------------------------------------

  async listMessagesPaged(userId: string, conversationId: string, cursor?: string, limit = 40): Promise<MessagePage> {
    const conversation = await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .findOne({ _id: conversationId });
    if (!conversation || !conversation.memberIds.includes(userId)) {
      return { items: [], hasOlder: false, nextCursor: null };
    }
    const pageSize = Math.max(1, Math.min(200, Math.round(limit)));
    const filter: Record<string, unknown> = { conversationId };
    if (cursor) filter.createdAt = { $lt: cursor };
    const docs = await this.db
      .collection<MessageDoc>(COLLECTIONS.MESSAGES)
      .find(filter, { sort: { createdAt: -1 }, limit: pageSize + 1 });
    const page = buildMessagePage(docs.map(messageDocToMessage), pageSize);
    return {
      ...page,
      items: deriveReadState(page.items, conversation.readState, userId),
    };
  }

  async listSharedActivity(userId: string, cursor?: string, limit = 10): Promise<ActivityPage> {
    const configured = await this.getConfiguredPartner(userId);
    if (!configured) return { items: [], hasMore: false, nextCursor: null };
    const pageSize = Math.max(1, Math.min(100, Math.round(limit)));
    const filter: Record<string, unknown> = {
      partnershipId: configured.partnership._id,
      status: 'ended',
    };
    if (cursor) filter.createdAt = { $lt: cursor };
    const docs = await this.db
      .collection<SharedFocusDoc>(COLLECTIONS.SHARED_FOCUS_SESSIONS)
      .find(filter, { sort: { createdAt: -1 }, limit: pageSize + 1 });
    const items: SharedActivityItem[] = docs.map((doc) => ({
      id: doc._id,
      type: 'shared_focus',
      title: 'Shared focus session',
      subtitle: `${doc.durationMinutes} min session with your partner`,
      minutes: doc.durationMinutes,
      status: 'ended',
      createdAt: doc.createdAt,
    }));
    return buildActivityPage(items, pageSize);
  }

  async listPlansPaged(userId: string, cursor?: string, limit = 20): Promise<PlanPage> {
    const pageSize = Math.max(1, Math.min(100, Math.round(limit)));
    const cursorFilter: Record<string, unknown> = cursor ? { updatedAt: { $lt: cursor } } : {};
    const personal = await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).find({
      ...cursorFilter,
      planType: 'personal',
      ownerId: userId,
    });
    const memberships = await this.db.collection<PlanMemberDoc>(COLLECTIONS.PLAN_MEMBERS).find({ userId });
    const commonIds = memberships.map((m) => m.planId);
    const common =
      commonIds.length === 0
        ? []
        : await this.db.collection<PlanDoc>(COLLECTIONS.PLANS).find({
            ...cursorFilter,
            planType: 'common',
            _id: { $in: commonIds },
          });
    const roleByPlan = new Map<number, PlanMemberDoc['role']>(memberships.map((m) => [m.planId, m.role]));
    const merged = [...personal, ...common]
      .map((doc) =>
        doc.planType === 'common' ? { ...planDocToPlan(doc), memberRole: roleByPlan.get(doc._id) } : planDocToPlan(doc),
      )
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    return buildPlanPage(merged, pageSize);
  }

  // ---- Shared snapshots (Phase 13) -----------------------------------------

  async listSnapshots(userId: string, conversationId: string, cursor?: string, limit = 12): Promise<SnapshotPage> {
    const conversation = await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .findOne({ _id: conversationId });
    if (!conversation || !conversation.memberIds.includes(userId)) {
      return { items: [], hasMore: false, nextCursor: null };
    }
    const pageSize = Math.max(1, Math.min(100, Math.round(limit)));
    const filter: Record<string, unknown> = { conversationId, type: MESSAGE_TYPE.IMAGE };
    if (cursor) filter.createdAt = { $lt: cursor };
    const docs = await this.db
      .collection<MessageDoc>(COLLECTIONS.MESSAGES)
      .find(filter, { sort: { createdAt: -1 }, limit: pageSize + 1 });
    const hasMore = docs.length > pageSize;
    const messages = docs.slice(0, pageSize);
    const mediaIds = messages.map((m) => m.mediaId).filter((id): id is string => Boolean(id));
    const metaById = new Map<string, ImageMetadataDoc>();
    if (mediaIds.length > 0) {
      const metas = await this.db
        .collection<ImageMetadataDoc>(COLLECTIONS.IMAGE_METADATA)
        .find({ gridFsFileId: { $in: mediaIds } });
      for (const meta of metas) metaById.set(meta.gridFsFileId, meta);
    }
    const nameById = new Map<string, string>();
    const items: SnapshotItem[] = [];
    for (const message of messages) {
      if (!message.mediaId) continue;
      const meta = metaById.get(message.mediaId);
      let senderName = nameById.get(message.senderId) ?? '';
      if (!senderName) {
        const profile = await this.db
          .collection<ProfileDoc>(COLLECTIONS.PROFILES)
          .findOne({ userId: message.senderId });
        senderName = profile?.displayName ?? 'Partner';
        nameById.set(message.senderId, senderName);
      }
      items.push({
        id: message._id,
        messageId: message._id,
        conversationId,
        senderId: message.senderId,
        senderName,
        caption: message.body ?? null,
        mediaId: message.mediaId,
        fileName: meta?.originalFileName ?? 'snapshot.png',
        mimeType: meta?.mimeType ?? 'image/png',
        size: meta?.fileSize ?? message.mediaSize ?? 0,
        status: (meta?.status ?? message.mediaStatus ?? 'active') as SnapshotItem['status'],
        exported: Boolean(meta?.exportedAt),
        createdAt: message.createdAt,
        url: `/api/media/${message.mediaId}`,
      });
    }
    const last = items[items.length - 1];
    return { items, hasMore, nextCursor: hasMore && last?.createdAt ? last.createdAt : null };
  }

  async saveSnapshot(
    userId: string,
    conversationId: string,
    input: import('@/lib/repositories/ProductivityRepository').SnapshotSaveInput,
  ): Promise<Message> {
    const conversation = await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .findOne({ _id: conversationId });
    if (!conversation || !conversation.memberIds.includes(userId)) {
      throw new Error('You are not a member of this conversation.');
    }
    const privacy = await this.db.collection<PrivacyDoc>(COLLECTIONS.PARTNER_PRIVACY_SETTINGS).findOne({ userId });
    if (!hasShareSnapshots(privacy)) {
      throw new Error('Snapshot sharing is disabled. Enable it in Partner privacy to share snapshots.');
    }
    const message: MessageDoc = {
      _id: crypto.randomUUID(),
      conversationId,
      senderId: userId,
      type: MESSAGE_TYPE.IMAGE,
      body: input.caption ?? null,
      mediaId: input.mediaId,
      mediaMime: input.mimeType,
      mediaSize: input.size,
      mediaStatus: 'active',
      planId: null,
      sharedFocusId: null,
      createdAt: nowIso(),
    };
    await this.db.collection<MessageDoc>(COLLECTIONS.MESSAGES).insertOne(message);
    broadcastPartnership(conversation.partnershipId, {
      type: 'chat.message',
      conversationId,
      message: messageDocToMessage(message),
      at: nowIso(),
    });
    return messageDocToMessage(message);
  }

  async exportSnapshots(userId: string, conversationId: string, messageIds: string[]): Promise<ZipExportResult> {
    const conversation = await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .findOne({ _id: conversationId });
    if (!conversation || !conversation.memberIds.includes(userId)) {
      throw new Error('You are not a member of this conversation.');
    }
    const files: ZipFileInput[] = [];
    const exported: string[] = [];
    const failed: ZipExportResult['failed'] = [];
    for (const messageId of messageIds) {
      const message = await this.db.collection<MessageDoc>(COLLECTIONS.MESSAGES).findOne({ _id: messageId });
      if (
        !message ||
        message.conversationId !== conversationId ||
        message.type !== MESSAGE_TYPE.IMAGE ||
        !message.mediaId
      ) {
        failed.push({ id: messageId, reason: 'Not a snapshot in this conversation.' });
        continue;
      }
      const meta = await this.db
        .collection<ImageMetadataDoc>(COLLECTIONS.IMAGE_METADATA)
        .findOne({ gridFsFileId: message.mediaId });
      if (!meta) {
        failed.push({ id: messageId, reason: 'Snapshot binary is missing.' });
        continue;
      }
      const bytes = await this.readGridFsFile(meta.gridFsFileId);
      if (!bytes || bytes.length === 0) {
        failed.push({ id: messageId, reason: 'Snapshot binary could not be read.' });
        continue;
      }
      files.push({ name: meta.originalFileName, data: bytes });
      exported.push(messageId);
      await this.db
        .collection<ImageMetadataDoc>(COLLECTIONS.IMAGE_METADATA)
        .updateOne({ gridFsFileId: meta.gridFsFileId }, { $set: { exportedAt: nowIso() } });
    }
    if (files.length === 0) {
      throw new RepositoryError('None of the selected snapshots could be exported.', 'EXPORT_FAILED', 409);
    }
    const zip = createZip(files, new Date());
    const fileName = `snapshots-${toIsoDate(new Date())}.zip`;
    await this.audit(userId, conversationId, 'snapshots.export', { count: files.length, fileName });
    return { fileName, base64: Buffer.from(zip).toString('base64'), exported, failed };
  }

  async removeSnapshotsAfterExport(
    userId: string,
    conversationId: string,
    messageIds: string[],
  ): Promise<SnapshotRemoveResult> {
    const conversation = await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .findOne({ _id: conversationId });
    if (!conversation || !conversation.memberIds.includes(userId)) {
      throw new Error('You are not a member of this conversation.');
    }
    const removed: string[] = [];
    const failed: SnapshotRemoveResult['failed'] = [];
    for (const messageId of messageIds) {
      const message = await this.db.collection<MessageDoc>(COLLECTIONS.MESSAGES).findOne({ _id: messageId });
      if (
        !message ||
        message.conversationId !== conversationId ||
        message.type !== MESSAGE_TYPE.IMAGE ||
        !message.mediaId
      ) {
        failed.push({ id: messageId, reason: 'Not a snapshot in this conversation.' });
        continue;
      }
      const meta = await this.db
        .collection<ImageMetadataDoc>(COLLECTIONS.IMAGE_METADATA)
        .findOne({ gridFsFileId: message.mediaId });
      if (!meta) {
        failed.push({ id: messageId, reason: 'Snapshot metadata is missing.' });
        continue;
      }
      if (!meta.exportedAt) {
        failed.push({ id: messageId, reason: 'Export the snapshot before removing it.' });
        continue;
      }
      // Mark metadata + message removed first (source of truth for the chat UI).
      await this.db.collection<ImageMetadataDoc>(COLLECTIONS.IMAGE_METADATA).updateOne(
        { gridFsFileId: meta.gridFsFileId },
        {
          $set: {
            status: 'exported_and_removed',
            deletedAt: nowIso(),
            deletionReason: 'exported',
          },
        },
      );
      await this.db
        .collection<MessageDoc>(COLLECTIONS.MESSAGES)
        .updateOne({ _id: messageId }, { $set: { mediaStatus: 'exported_and_removed' } });
      // Best-effort removal of the binary itself.
      await this.deleteGridFsFile(meta.gridFsFileId);
      // System note placed where the snapshot was, so the history reads naturally.
      const noteAt = new Date(Date.parse(message.createdAt) + 1).toISOString();
      const note: MessageDoc = {
        _id: crypto.randomUUID(),
        conversationId,
        senderId: userId,
        type: MESSAGE_TYPE.SYSTEM,
        body: 'A snapshot was exported and removed.',
        planId: null,
        sharedFocusId: null,
        createdAt: noteAt,
      };
      await this.db.collection<MessageDoc>(COLLECTIONS.MESSAGES).insertOne(note);
      broadcastPartnership(conversation.partnershipId, {
        type: 'chat.message',
        conversationId,
        message: messageDocToMessage(note),
        at: nowIso(),
      });
      removed.push(messageId);
    }
    if (removed.length > 0) {
      await this.audit(userId, conversationId, 'snapshots.remove', { removed: removed.length, failed: failed.length });
    }
    return { removed, failed };
  }

  private async readGridFsFile(fileId: string): Promise<Uint8Array | null> {
    const files = await this.db.collection<Document>(`${GRIDFS_BUCKET_NAME}.files`).findOne({ _id: fileId });
    if (!files) return null;
    const chunks = await this.db
      .collection<Document>(`${GRIDFS_BUCKET_NAME}.chunks`)
      .find({ files_id: fileId }, { sort: { n: 1 } });
    const parts: Uint8Array[] = [];
    for (const chunk of chunks) {
      const bytes = binaryToBytes(chunk.data);
      if (bytes.length === 0) continue;
      parts.push(bytes);
    }
    if (parts.length === 0) return null;
    const total = parts.reduce((acc, p) => acc + p.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      merged.set(part, offset);
      offset += part.length;
    }
    return merged;
  }

  private async deleteGridFsFile(fileId: string): Promise<void> {
    try {
      await this.db.collection<Document>(`${GRIDFS_BUCKET_NAME}.chunks`).deleteMany({ files_id: fileId });
      await this.db.collection<Document>(`${GRIDFS_BUCKET_NAME}.files`).deleteOne({ _id: fileId });
    } catch {
      // best-effort — metadata already marks the snapshot removed
    }
  }

  private async audit(
    userId: string,
    conversationId: string,
    action: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.db.collection<Document>(COLLECTIONS.AUDIT_LOGS).insertOne({
        _id: crypto.randomUUID(),
        userId,
        conversationId,
        action,
        detail,
        createdAt: nowIso(),
      });
    } catch {
      // audit logging must never break the primary operation
    }
  }

  async sendMessage(userId: string, conversationId: string, input: SendMessageInput): Promise<Message> {
    const conversation = await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .findOne({ _id: conversationId });
    if (!conversation || !conversation.memberIds.includes(userId)) {
      throw new Error('You are not a member of this conversation.');
    }
    const message: MessageDoc = {
      _id: crypto.randomUUID(),
      conversationId,
      senderId: userId,
      type: input.type,
      body: input.body ?? null,
      mediaId: input.mediaId ?? null,
      mediaMime: input.mediaMime ?? null,
      mediaSize: input.mediaSize ?? null,
      mediaStatus: input.mediaId ? 'active' : undefined,
      planId: input.planId ?? null,
      sharedFocusId: input.sharedFocusId ?? null,
      createdAt: nowIso(),
    };
    await this.db.collection<MessageDoc>(COLLECTIONS.MESSAGES).insertOne(message);
    broadcastPartnership(conversation.partnershipId, {
      type: 'chat.message',
      conversationId,
      message: messageDocToMessage(message),
      at: nowIso(),
    });
    return messageDocToMessage(message);
  }

  async markRead(userId: string, conversationId: string): Promise<boolean> {
    const conversation = await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .findOne({ _id: conversationId });
    if (!conversation || !conversation.memberIds.includes(userId)) return false;
    const readAt = nowIso();
    // Conversation-level read cursor: a single update marks everything up to now as read.
    await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .updateOne({ _id: conversationId }, { $set: { [`readState.${userId}`]: readAt } });
    broadcastPartnership(conversation.partnershipId, {
      type: 'chat.read',
      conversationId,
      readerId: userId,
      readAt,
    });
    return true;
  }

  async sendTyping(userId: string, conversationId: string): Promise<boolean> {
    const conversation = await this.db
      .collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS)
      .findOne({ _id: conversationId });
    if (!conversation || !conversation.memberIds.includes(userId)) return false;
    broadcastPartnership(conversation.partnershipId, {
      type: 'chat.typing',
      conversationId,
      userId,
      at: nowIso(),
    });
    return true;
  }

  // ---- Collaboration state (compatibility view) ----------------------------

  async loadCollabData(): Promise<CollabData> {
    return getDefaultCollabData();
  }

  async saveCollabData(): Promise<boolean> {
    return true;
  }

  // ---- Media metadata ------------------------------------------------------

  async saveMedia(meta: MediaMeta): Promise<MediaMeta> {
    const doc: ImageMetadataDoc = {
      _id: meta.id,
      gridFsFileId: meta.id,
      messageId: meta.messageId,
      conversationId: meta.conversationId ?? '',
      ownerId: meta.ownerId ?? '',
      originalFileName: meta.fileName,
      mimeType: meta.mimeType,
      fileSize: meta.size,
      width: meta.width,
      height: meta.height,
      status: meta.status ?? 'active',
      exportedAt: null,
      deletedAt: null,
      createdAt: meta.createdAt,
    };
    await this.db.collection<ImageMetadataDoc>(COLLECTIONS.IMAGE_METADATA).insertOne(doc);
    return meta;
  }

  async getMedia(mediaId: string): Promise<MediaMeta | null> {
    const doc = await this.db
      .collection<ImageMetadataDoc>(COLLECTIONS.IMAGE_METADATA)
      .findOne({ gridFsFileId: mediaId });
    if (!doc) return null;
    return {
      id: doc._id,
      messageId: doc.messageId,
      conversationId: doc.conversationId,
      ownerId: doc.ownerId,
      fileName: doc.originalFileName,
      mimeType: doc.mimeType,
      size: doc.fileSize,
      width: doc.width,
      height: doc.height,
      status: doc.status,
      createdAt: doc.createdAt,
    };
  }

  async updateMedia(mediaId: string, patch: Partial<MediaMeta>): Promise<MediaMeta | null> {
    const set: Record<string, unknown> = {};
    if (patch.status) set.status = patch.status;
    if (patch.messageId) set.messageId = patch.messageId;
    if (patch.fileName) set.originalFileName = patch.fileName;
    if (typeof patch.size === 'number') set.fileSize = patch.size;
    await this.db
      .collection<ImageMetadataDoc>(COLLECTIONS.IMAGE_METADATA)
      .updateOne({ gridFsFileId: mediaId }, { $set: set });
    return this.getMedia(mediaId);
  }

  // ---- Realtime ------------------------------------------------------------

  subscribe(): () => void {
    // Real-time delivery is handled by the SSE hub (see app/api/realtime) which reads
    // persisted MongoDB state. No per-client subscription needed here.
    return () => undefined;
  }
}

export function createMongoDbRepository(): ProductivityRepository | null {
  if (!isMongoConfigured()) return null;
  return new MongoDbProductivityRepository(createRealDbPort());
}

export { PLAN_KIND, PLAN_VISIBILITY };

// Keep the GridFS bucket reference importable for the media services.
export type GridFSBucketLike = Awaited<ReturnType<typeof getGridFSBucket>>;
