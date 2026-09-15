/**
 * Backfill numeric IDs for existing focus sessions that have UUID _id values.
 * Run with: npx tsx scripts/fix-session-ids.ts
 *
 * The old code used crypto.randomUUID() for session _id, but the frontend expects
 * numeric IDs (Session.id: number). This script reassigns _id to a numeric value
 * derived from createdAt, and stores the old UUID in legacyId for reference.
 */
import './loadEnv';
import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'mywhiteboard';
  if (!uri) {
    console.error('FAIL: MONGODB_URI is not set in .env.local');
    process.exit(1);
  }

  console.log(`Fix session IDs: database="${dbName}"`);

  const client = new MongoClient(uri, {
    appName: 'mywhiteboard-fix-session-ids',
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas.');

    const db = client.db(dbName);
    const sessions = db.collection('focusSessions');

    // Find all sessions where _id is not a valid number (UUID strings)
    const allSessions = await sessions.find({}).toArray();
    let fixed = 0;
    let skipped = 0;

    for (const doc of allSessions) {
      const id = doc._id;
      // If _id is already a numeric string, skip
      if (/^\d+$/.test(String(id))) {
        skipped++;
        continue;
      }

      // Derive a numeric ID from createdAt or use a counter
      const createdAt = doc.createdAt as string | undefined;
      let numericId: number;
      if (createdAt) {
        numericId = new Date(createdAt).getTime();
      } else {
        numericId = Date.now() - fixed; // fallback: stagger by 1ms
      }

      // Ensure uniqueness by appending a small offset if needed
      const existing = await sessions.findOne({ _id: String(numericId) } as never);
      if (existing) {
        numericId = numericId + fixed + 1;
      }

      const oldId = String(id);
      const newId = String(numericId);

      // MongoDB forbids mutating _id, so we insert new then delete old
      const docObj = doc as { _id: unknown } & Record<string, unknown>;
      const { _id: _idField, ...rest } = docObj;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sessions.insertOne({ _id: newId, legacyId: numericId, ...rest } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sessions.deleteOne({ _id: oldId } as any);
      fixed++;
      console.log(`  Fixed: ${oldId} → ${newId}`);
    }

    console.log(`\nDone. Fixed: ${fixed}, Skipped (already numeric): ${skipped}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FAIL: ${message}`);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
