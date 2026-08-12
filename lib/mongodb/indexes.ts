import '@/lib/server-only';
import { getMongoDb } from '@/lib/mongodb/connection';
import { COLLECTIONS } from '@/lib/mongodb/collections';

interface IndexSpec {
  name: string;
  keys: Record<string, 1 | -1>;
  unique?: boolean;
  sparse?: boolean;
}

const INDEXES: Record<string, IndexSpec[]> = {
  [COLLECTIONS.USERS]: [{ name: 'users_email_unique', keys: { email: 1 }, unique: true }],
  [COLLECTIONS.AUTH_SESSIONS]: [
    { name: 'sessions_token_hash_unique', keys: { tokenHash: 1 }, unique: true },
    { name: 'sessions_userId', keys: { userId: 1 } },
    { name: 'sessions_expiresAt', keys: { expiresAt: 1 } },
  ],
  [COLLECTIONS.PROFILES]: [{ name: 'profiles_email_unique', keys: { email: 1 }, unique: true }],
  [COLLECTIONS.PLANS]: [
    { name: 'plans_ownerId_planType', keys: { ownerId: 1, planType: 1 } },
    { name: 'plans_ownerId_visibility', keys: { ownerId: 1, visibility: 1 } },
    { name: 'plans_updatedAt', keys: { updatedAt: -1 } },
  ],
  [COLLECTIONS.PLAN_MEMBERS]: [
    { name: 'planMembers_planId_userId_unique', keys: { planId: 1, userId: 1 }, unique: true },
    { name: 'planMembers_userId', keys: { userId: 1 } },
  ],
  [COLLECTIONS.FOCUS_SESSIONS]: [
    { name: 'focusSessions_userId_date', keys: { userId: 1, date: 1 } },
    { name: 'focusSessions_userId_status', keys: { userId: 1, status: 1 } },
    { name: 'focusSessions_userId_startedAt', keys: { userId: 1, startedAt: -1 } },
    { name: 'focusSessions_userId_createdAt', keys: { userId: 1, createdAt: -1 } },
  ],
  [COLLECTIONS.STATISTICS]: [{ name: 'statistics_userId_date_unique', keys: { userId: 1, date: 1 }, unique: true }],
  [COLLECTIONS.PARTNERSHIPS]: [
    { name: 'partnerships_userA_userB_unique', keys: { userAId: 1, userBId: 1 }, unique: true },
    { name: 'partnerships_userA_status', keys: { userAId: 1, status: 1 } },
    { name: 'partnerships_userB_status', keys: { userBId: 1, status: 1 } },
  ],
  [COLLECTIONS.PARTNER_PRIVACY_SETTINGS]: [
    { name: 'partnerPrivacySettings_userId_unique', keys: { userId: 1 }, unique: true },
  ],
  [COLLECTIONS.CONVERSATIONS]: [
    { name: 'conversations_partnershipId_unique', keys: { partnershipId: 1 }, unique: true },
    { name: 'conversations_memberIds', keys: { memberIds: 1 } },
  ],
  [COLLECTIONS.MESSAGES]: [
    { name: 'messages_conversationId_createdAt', keys: { conversationId: 1, createdAt: 1 } },
    { name: 'messages_conversationId_readAt', keys: { conversationId: 1, readAt: 1 } },
    { name: 'messages_conversationId_type_createdAt', keys: { conversationId: 1, type: 1, createdAt: -1 } },
  ],
  [COLLECTIONS.SHARED_FOCUS_SESSIONS]: [
    { name: 'sharedFocus_partnershipId_status', keys: { partnershipId: 1, status: 1 } },
    { name: 'sharedFocus_partnershipId_status_createdAt', keys: { partnershipId: 1, status: 1, createdAt: -1 } },
  ],
  [COLLECTIONS.NOTIFICATIONS]: [{ name: 'notifications_userId_readAt', keys: { userId: 1, readAt: 1 } }],
  [COLLECTIONS.MIGRATION_RECORDS]: [
    { name: 'migrationRecords_name_version_unique', keys: { migrationName: 1, version: 1 }, unique: true },
  ],
  [COLLECTIONS.IMAGE_METADATA]: [
    { name: 'imageMetadata_gridFsFileId_unique', keys: { gridFsFileId: 1 }, unique: true },
    { name: 'imageMetadata_messageId', keys: { messageId: 1 } },
    { name: 'imageMetadata_conversationId', keys: { conversationId: 1 } },
    { name: 'imageMetadata_ownerId', keys: { ownerId: 1 } },
  ],
  [COLLECTIONS.IMAGE_EXPORTS]: [{ name: 'imageExports_userId_createdAt', keys: { userId: 1, createdAt: -1 } }],
  [COLLECTIONS.AUDIT_LOGS]: [{ name: 'auditLogs_userId_createdAt', keys: { userId: 1, createdAt: -1 } }],
  [COLLECTIONS.DAILY_ANALYTICS]: [
    { name: 'dailyAnalytics_userId_date_unique', keys: { userId: 1, date: 1 }, unique: true },
  ],
  [COLLECTIONS.WEEKLY_ANALYTICS]: [
    { name: 'weeklyAnalytics_userId_weekStart_unique', keys: { userId: 1, weekStart: 1 }, unique: true },
  ],
  [COLLECTIONS.MONTHLY_ANALYTICS]: [
    { name: 'monthlyAnalytics_userId_month_unique', keys: { userId: 1, month: 1 }, unique: true },
  ],
};

export async function ensureIndexes(): Promise<string[]> {
  const db = await getMongoDb();
  const created: string[] = [];
  for (const [collectionName, specs] of Object.entries(INDEXES)) {
    for (const spec of specs) {
      const options: Record<string, unknown> = { name: spec.name };
      if (spec.unique !== undefined) options.unique = spec.unique;
      if (spec.sparse !== undefined) options.sparse = spec.sparse;
      try {
        await db.collection(collectionName).createIndex(spec.keys, options);
        created.push(`${collectionName}.${spec.name}`);
      } catch (error) {
        // Index already exists with different options → ignore; never crash startup.
        if (!(error instanceof Error) || !/IndexOptionsConflict|already exists/i.test(error.message)) {
          throw error;
        }
      }
    }
  }
  return created;
}
