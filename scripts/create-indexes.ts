/**
 * Creates MongoDB indexes for the productivity app.
 * Run with: npx tsx scripts/create-indexes.ts
 *
 * Safe to run multiple times — existing indexes are skipped.
 */
import './loadEnv';
import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'mywhiteboard';
  if (!uri) {
    console.error('MONGODB_URI is not set. Cannot create indexes.');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB database "${dbName}"...`);
  const client = new MongoClient(uri, {
    appName: 'mywhiteboard-indexes',
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();
    const db = client.db(dbName);

    const indexes: { collection: string; key: Record<string, 1 | -1>; name?: string; unique?: boolean }[] = [
      // Users
      { collection: 'users', key: { email: 1 }, name: 'idx_users_email', unique: true },

      // Auth sessions
      { collection: 'sessions', key: { tokenHash: 1 }, name: 'idx_sessions_tokenHash', unique: true },
      { collection: 'sessions', key: { userId: 1 }, name: 'idx_sessions_userId' },
      { collection: 'sessions', key: { expiresAt: 1 }, name: 'idx_sessions_expiresAt' },

      // Profiles
      { collection: 'profiles', key: { userId: 1 }, name: 'idx_profiles_userId', unique: true },

      // Plans
      { collection: 'plans', key: { ownerId: 1, createdAt: -1 }, name: 'plans_ownerId_createdAt' },
      { collection: 'plans', key: { planType: 1, ownerId: 1 }, name: 'plans_type_ownerId' },

      // Plan members
      { collection: 'planMembers', key: { userId: 1 }, name: 'planMembers_userId' },
      { collection: 'planMembers', key: { planId: 1 }, name: 'planMembers_planId' },

      // Focus sessions
      { collection: 'focusSessions', key: { userId: 1, createdAt: -1 }, name: 'focusSessions_userId_createdAt' },
      { collection: 'focusSessions', key: { userId: 1, date: -1 }, name: 'focusSessions_userId_date' },

      // Statistics
      { collection: 'statistics', key: { userId: 1, date: -1 }, name: 'statistics_userId_date', unique: true },

      // Conversations
      { collection: 'conversations', key: { memberIds: 1 }, name: 'conversations_memberIds' },

      // Messages
      { collection: 'messages', key: { conversationId: 1, createdAt: -1 }, name: 'messages_conversationId_createdAt' },

      // Shared focus
      { collection: 'sharedFocusSessions', key: { partnershipId: 1 }, name: 'sharedFocus_partnershipId' },

      // Partnerships
      { collection: 'partnerships', key: { userAId: 1 }, name: 'partnerships_userAId' },
      { collection: 'partnerships', key: { userBId: 1 }, name: 'partnerships_userBId' },

      // Analytics
      { collection: 'dailyAnalytics', key: { userId: 1, date: -1 }, name: 'dailyAnalytics_userId_date', unique: true },
      {
        collection: 'weeklyAnalytics',
        key: { userId: 1, weekStart: -1 },
        name: 'weeklyAnalytics_userId_week',
        unique: true,
      },
      {
        collection: 'monthlyAnalytics',
        key: { userId: 1, month: -1 },
        name: 'monthlyAnalytics_userId_month',
        unique: true,
      },

      // Dashboard layouts
      { collection: 'dashboardLayouts', key: { userId: 1 }, name: 'dashboardLayouts_userId', unique: true },

      // Task types
      { collection: 'taskTypes', key: { userId: 1 }, name: 'taskTypes_userId', unique: true },

      // Image metadata
      { collection: 'imageMetadata', key: { conversationId: 1 }, name: 'imageMetadata_conversationId' },
      { collection: 'imageMetadata', key: { ownerId: 1 }, name: 'imageMetadata_ownerId' },

      // Audit logs
      { collection: 'auditLogs', key: { userId: 1, createdAt: -1 }, name: 'auditLogs_userId_createdAt' },
    ];

    let created = 0;
    let skipped = 0;

    for (const idx of indexes) {
      try {
        await db.collection(idx.collection).createIndex(idx.key, {
          name: idx.name,
          unique: idx.unique ?? false,
          background: true,
        });
        created++;
        console.log(`  ✓ ${idx.name ?? JSON.stringify(idx.key)} on ${idx.collection}`);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('already exists')) {
          skipped++;
        } else {
          console.error(`  ✗ ${idx.name ?? JSON.stringify(idx.key)} on ${idx.collection}:`, err);
        }
      }
    }

    console.log(`\nDone. ${created} index(es) created, ${skipped} already existed.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
