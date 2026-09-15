import type { Document } from 'mongodb';
import type { PlanStatus, PlanTypeValue, PlanPriority, PlanFile } from '@/src/types';
import type { MediaStatus, SharedFocusParticipant, SharedFocusStatus } from '@/src/types/collaboration';
import type { DashboardLayout } from '@/lib/dashboard/types';

export interface UserDoc extends Document {
  _id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  displayName: string;
  taskTypes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionDoc extends Document {
  _id: string;
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface ProfileDoc extends Document {
  _id: string;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  status: 'online' | 'offline' | 'focusing';
  lastSeenAt: string;
  createdAt: string;
}

export interface PlanDoc extends Document {
  _id: number;
  planType: 'personal' | 'common';
  visibility?: 'private' | 'partner_shared';
  ownerId: string;
  title: string;
  description: string;
  type: PlanTypeValue;
  status: PlanStatus;
  date: string;
  priority: PlanPriority;
  category: string;
  file?: PlanFile | null;
  memberCount: number;
  legacyId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanMemberDoc extends Document {
  _id: string;
  planId: number;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

export interface FocusSessionDoc extends Document {
  _id: string;
  userId: string;
  task: string;
  duration: string;
  durationMinutes: number;
  date: string;
  status: string;
  startTime?: string;
  endTime?: string;
  actualDuration?: string;
  startedAt?: string;
  sharedFocusId?: string | null;
  legacyId?: number;
  createdAt: string;
}

export interface StatsDoc extends Document {
  _id: string;
  userId: string;
  date: string;
  focusMinutes: number;
  sessionsCompleted: number;
  plansCompleted: number;
  streak: number;
  updatedAt: string;
}

export interface PartnershipDoc extends Document {
  _id: string;
  userAId: string;
  userBId: string;
  status: 'pending' | 'active' | 'paused' | 'ended';
  relationshipType?: 'invite' | 'fixed_partner';
  invitedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacyDoc extends Document {
  _id: string;
  userId: string;
  shareWeeklyStats: boolean;
  shareStreak: boolean;
  sharePlans: boolean;
  shareLiveFocus: boolean;
  shareSnapshots?: boolean;
  updatedAt: string;
}

export interface SharedFocusDoc extends Document {
  _id: string;
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

export interface ConversationDoc extends Document {
  _id: string;
  partnershipId: string;
  memberIds: string[];
  createdAt: string;
  readState?: Record<string, string>;
}

export interface MessageDoc extends Document {
  _id: string;
  conversationId: string;
  senderId: string;
  type: string;
  body?: string | null;
  mediaId?: string | null;
  mediaMime?: string | null;
  mediaSize?: number | null;
  mediaStatus?: MediaStatus;
  planId?: number | null;
  sharedFocusId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface ImageMetadataDoc extends Document {
  _id: string;
  gridFsFileId: string;
  messageId: string;
  conversationId: string;
  ownerId: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  status: MediaStatus;
  exportedAt?: string | null;
  deletedAt?: string | null;
  deletionReason?: string | null;
  createdAt: string;
}

export interface MigrationRecordDoc extends Document {
  _id: string;
  migrationName: string;
  version: number;
  userId?: string;
  sourceChecksum: string;
  completedAt: string;
  rowCounts: { users: number; plans: number; sessions: number; files: number };
}

/**
 * Precomputed productivity summary for a single calendar day. Populated by the analytics
 * engine (lib/analytics) from the raw focusSessions/plans sources; the dashboard reads
 * these aggregates instead of recalculating on every request.
 */
export interface DailyAnalyticsDoc extends Document {
  _id: string;
  userId: string;
  date: string;
  focusMinutes: number;
  sessionsCompleted: number;
  sessionsMissed: number;
  sessionsInProgress: number;
  interruptions: number;
  breaks: number;
  avgSessionMinutes: number;
  plansCompleted: number;
  plansInProgress: number;
  plansPending: number;
  planCompletionRate: number;
  categoryFocusMinutes: Record<string, number>;
  hourlyMinutes: number[];
  bestHour: number | null;
  sharedFocusMinutes: number;
  computedAt: string;
}

/** A calendar-week rollup of the daily analytics documents. */
export interface WeeklyAnalyticsDoc extends Document {
  _id: string;
  userId: string;
  weekStart: string;
  focusMinutes: number;
  sessionsCompleted: number;
  planCompletionRate: number;
  dailyAverageMin: number;
  bestDayIndex: number | null;
  hourlyMinutes: number[];
  topCategory: string | null;
  daysWithFocus: number;
  computedAt: string;
}

/** A calendar-month rollup of the weekly analytics documents. */
export interface MonthlyAnalyticsDoc extends Document {
  _id: string;
  userId: string;
  month: string;
  focusMinutes: number;
  sessionsCompleted: number;
  planCompletionRate: number;
  weeklyAverageMin: number;
  preferredHours: number[];
  bestWeekdayIndex: number | null;
  topCategory: string | null;
  weekCount: number;
  trend: number[];
  computedAt: string;
}

/**
 * The user's customised dashboard layout (Phase 18): widget order, visibility, size and
 * collapsed state. One document per user, keyed by `_id === userId`.
 */
export interface DashboardLayoutDoc extends Document {
  _id: string;
  userId: string;
  layout: DashboardLayout;
  updatedAt: string;
}

/**
 * Per-user custom task type labels (e.g. "Study", "Work", "Exercise"). One document per
 * user, keyed by `_id === userId`.
 */
export interface TaskTypesDoc extends Document {
  _id: string;
  userId: string;
  types: string[];
  updatedAt: string;
}

/**
 * Irreversible daily focus goal. One document per user per day. Insert-only — once set
 * for a given date, the goal cannot be changed (enforced by unique index).
 */
export interface DailyGoalDoc extends Document {
  _id: string;
  userId: string;
  date: string;
  targetMinutes: number;
  createdAt: string;
}
