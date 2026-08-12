import {
  isPartnershipStatus,
  isPlanKind,
  isPlanVisibility,
  MEDIA_STATUS,
  MESSAGE_TYPE,
  PLAN_MEMBER_ROLE,
  SHARED_FOCUS_STATUS,
  type CollabData,
  type Conversation,
  type MediaMeta,
  type MediaStatus,
  type Message,
  type MessageType,
  type PartnerPrivacySettings,
  type Partnership,
  type PlanMemberRole,
  type Profile,
  type SharedFocusParticipant,
  type SharedFocusSession,
  type SharedFocusStatus,
  type UserStatus,
} from '@/src/types/collaboration';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): boolean {
  return typeof value === 'string';
}

function isBoolean(value: unknown): boolean {
  return typeof value === 'boolean';
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'number';
}

function isUserStatus(value: unknown): value is UserStatus {
  return value === 'online' || value === 'offline' || value === 'focusing' || value === 'away';
}

function isPlanMemberRoleValue(value: unknown): value is PlanMemberRole {
  return (Object.values(PLAN_MEMBER_ROLE) as string[]).includes(value as string);
}

export function isValidProfile(value: unknown): value is Profile {
  if (!isObject(value)) return false;
  return (
    isString(value.id) &&
    isString(value.email) &&
    isString(value.displayName) &&
    isOptionalString(value.avatarUrl) &&
    isUserStatus(value.status) &&
    isString(value.lastSeenAt)
  );
}

export function isValidPartnership(value: unknown): value is Partnership {
  if (!isObject(value)) return false;
  return (
    isString(value.id) &&
    isString(value.userAId) &&
    isString(value.userBId) &&
    isPartnershipStatus(value.status) &&
    isOptionalString(value.invitedBy) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

export function isValidPrivacySettings(value: unknown): value is PartnerPrivacySettings {
  if (!isObject(value)) return false;
  // shareSnapshots is optional so records written before Phase 13 stay valid.
  return (
    isString(value.userId) &&
    isBoolean(value.shareWeeklyStats) &&
    isBoolean(value.shareStreak) &&
    isBoolean(value.sharePlans) &&
    isBoolean(value.shareLiveFocus) &&
    (value.shareSnapshots === undefined || isBoolean(value.shareSnapshots))
  );
}

export function isValidConversation(value: unknown): value is Conversation {
  if (!isObject(value)) return false;
  return isString(value.id) && isString(value.partnershipId) && isString(value.createdAt);
}

export function isMessageType(value: unknown): value is MessageType {
  return typeof value === 'string' && (Object.values(MESSAGE_TYPE) as string[]).includes(value);
}

export function isMediaStatus(value: unknown): value is MediaStatus {
  return typeof value === 'string' && (Object.values(MEDIA_STATUS) as string[]).includes(value);
}

export function isValidMessage(value: unknown): value is Message {
  if (!isObject(value)) return false;
  return (
    isString(value.id) &&
    isString(value.conversationId) &&
    isString(value.senderId) &&
    isMessageType(value.type) &&
    isOptionalString(value.body) &&
    isOptionalString(value.mediaId) &&
    isOptionalString(value.mediaMime) &&
    isOptionalNumber(value.mediaSize) &&
    isOptionalField(value.mediaStatus, isMediaStatus) &&
    isOptionalNumber(value.planId) &&
    isOptionalString(value.sharedFocusId) &&
    isOptionalString(value.readAt) &&
    (value.delivery === undefined || value.delivery === 'sending' || value.delivery === 'sent') &&
    isString(value.createdAt)
  );
}

function isOptionalField(value: unknown, check: (v: unknown) => boolean): boolean {
  return value === undefined || value === null || check(value);
}

export function isValidSharedFocusStatus(value: unknown): value is SharedFocusStatus {
  return typeof value === 'string' && (Object.values(SHARED_FOCUS_STATUS) as string[]).includes(value);
}

export function isValidSharedFocusParticipant(value: unknown): value is SharedFocusParticipant {
  if (!isObject(value)) return false;
  return (
    isString(value.userId) &&
    isBoolean(value.ready) &&
    isString(value.joinedAt) &&
    isBoolean(value.completed)
  );
}

export function isValidSharedFocusSession(value: unknown): value is SharedFocusSession {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.participants) || !value.participants.every(isValidSharedFocusParticipant)) return false;
  return (
    isString(value.id) &&
    isString(value.partnershipId) &&
    isValidSharedFocusStatus(value.status) &&
    typeof value.durationMinutes === 'number' &&
    isOptionalString(value.startedAt) &&
    isOptionalString(value.pausedAt) &&
    typeof value.totalPausedMs === 'number' &&
    isOptionalString(value.endsAt) &&
    isString(value.createdBy) &&
    isString(value.createdAt)
  );
}

export function isValidMediaMeta(value: unknown): value is MediaMeta {
  if (!isObject(value)) return false;
  return (
    isString(value.id) &&
    isString(value.messageId) &&
    isOptionalString(value.conversationId) &&
    isOptionalString(value.ownerId) &&
    isString(value.fileName) &&
    isString(value.mimeType) &&
    typeof value.size === 'number' &&
    isOptionalNumber(value.width) &&
    isOptionalNumber(value.height) &&
    isMediaStatus(value.status) &&
    isString(value.createdAt)
  );
}

export function isValidCollabData(value: unknown): value is CollabData {
  if (!isObject(value)) return false;
  if (value.version !== 1) return false;
  if (value.currentUserId !== null && !isString(value.currentUserId)) return false;
  if (!Array.isArray(value.profiles) || !value.profiles.every(isValidProfile)) return false;
  if (!Array.isArray(value.partnerships) || !value.partnerships.every(isValidPartnership)) return false;
  if (!Array.isArray(value.privacySettings) || !value.privacySettings.every(isValidPrivacySettings)) return false;
  if (!Array.isArray(value.conversations) || !value.conversations.every(isValidConversation)) return false;
  if (!Array.isArray(value.messages) || !value.messages.every(isValidMessage)) return false;
  if (!Array.isArray(value.sharedFocusSessions) || !value.sharedFocusSessions.every(isValidSharedFocusSession)) {
    return false;
  }
  if (!isObject(value.mediaMeta)) return false;
  return Object.values(value.mediaMeta).every(isValidMediaMeta);
}

export function getDefaultCollabData(): CollabData {
  return {
    version: 1,
    currentUserId: null,
    profiles: [],
    partnerships: [],
    privacySettings: [],
    conversations: [],
    messages: [],
    sharedFocusSessions: [],
    mediaMeta: {},
  };
}

/** A plan is considered shared when it is a common plan or has partner_shared visibility. */
export function isPlanSharedWithPartner(
  plan: { planType?: string; visibility?: string },
  isPartnerActive = true,
): boolean {
  if (!isPartnerActive) return false;
  if (plan.planType === 'common') return true;
  return plan.visibility === 'partner_shared';
}

export function isPlanPersonal(plan: { planType?: string }): boolean {
  return plan.planType === undefined || plan.planType === null || plan.planType === 'personal';
}

export { isPlanKind, isPlanVisibility, isPlanMemberRoleValue as isPlanMemberRole };
