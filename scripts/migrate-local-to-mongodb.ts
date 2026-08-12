/**
 * Local JSON → MongoDB migration runner.
 *
 * Usage:
 *   npm run migrate:assess          # validate + backup + report (safe, no DB write)
 *   npm run migrate:run -- --email you@example.com   # full migration (requires MONGODB_URI)
 *
 * Rules:
 *   - Never runs automatically.
 *   - Creates a backup snapshot before writing anything.
 *   - Preserves legacy plan/session ids (legacyId / _id) where possible.
 *   - Idempotent: a completed migration for the same source checksum is a no-op.
 *   - storage/data.json is never deleted or overwritten.
 */
import fs from 'fs';
import path from 'path';
import './loadEnv';
import {
  createBackupSnapshot,
  ensureBackupsDir,
  readDataJson,
  checksumFile,
} from '@/lib/migration/backup';
import {
  buildReport,
  isMigrationComplete,
  recordMigration,
  resetMigrationState,
} from '@/lib/migration/state';
import { MIGRATION_NAME, MIGRATION_VERSION } from '@/lib/config';
import { generateUserId, hashPassword } from '@/lib/auth/password';
import { isMongoConfigured, getMongoDb } from '@/lib/mongodb/connection';
import { COLLECTIONS } from '@/lib/mongodb/collections';
import { ensureIndexes } from '@/lib/mongodb/indexes';
import type { PlanDoc, FocusSessionDoc, ProfileDoc, UserDoc, MigrationRecordDoc } from '@/lib/mongodb/types';
import { parseDuration } from '@/src/utils/time';
import { PLAN_STATUS } from '@/src/types';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--run' || arg === '--assess') {
      args[arg.slice(2)] = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
      args[key] = value;
      if (value !== '') i += 1;
    }
  }
  return args;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const dataFile = path.join(process.cwd(), 'storage', 'data.json');

  if (!fs.existsSync(dataFile)) {
    console.error('storage/data.json not found. Nothing to migrate.');
    process.exit(1);
  }

  console.log('Reading storage/data.json ...');
  const data = readDataJson();
  const checksum = checksumFile(dataFile);
  const backup = createBackupSnapshot();
  console.log(`  Valid: true (plans=${data.plans.length}, sessions=${data.sessions.length})`);
  console.log(`  Backup: ${backup.path}`);
  console.log(`  Checksum: ${checksum}`);

  const counts = {
    users: 1,
    plans: data.plans.length,
    sessions: data.sessions.length,
    files: data.plans.filter((p) => Boolean(p.file)).length,
  };

  if (args.assess || !args.run) {
    const report = buildReport(counts, ['INFO Assessment only — no MongoDB writes performed. Run with --run to migrate.']);
    const reportPath = path.join(ensureBackupsDir(), 'migration-report.txt');
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(report);
    console.log(`\nReport written to ${reportPath}`);
    return;
  }

  if (!isMongoConfigured()) {
    console.error('MONGODB_URI is not configured. Set it in your environment before migrating.');
    process.exit(1);
  }

  if (isMigrationComplete(checksum)) {
    console.log('Migration already completed for this source. Skipping (idempotent).');
    return;
  }

  const email = typeof args.email === 'string' && args.email ? args.email : '';
  if (!email) {
    console.error('--email <address> is required to create the migrated user account.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB and ensuring indexes ...');
  const db = await getMongoDb();
  const indexes = await ensureIndexes();
  console.log(`  Indexes ensured (${indexes.length}).`);

  const users = db.collection<UserDoc>(COLLECTIONS.USERS);
  const profiles = db.collection<ProfileDoc>(COLLECTIONS.PROFILES);
  const plans = db.collection<PlanDoc>(COLLECTIONS.PLANS);
  const focusSessions = db.collection<FocusSessionDoc>(COLLECTIONS.FOCUS_SESSIONS);
  const migrationRecords = db.collection<MigrationRecordDoc>(COLLECTIONS.MIGRATION_RECORDS);

  const userId = generateUserId();
  const existingUser = await users.findOne({ email });
  const finalUserId = existingUser?._id ?? userId;
  if (existingUser) {
    console.log(`  User already exists for ${email}. Reusing account (${finalUserId}).`);
  } else {
    const passwordHash = hashPassword(typeof args.password === 'string' && args.password ? args.password : 'change-me');
    const now = new Date().toISOString();
    await users.insertOne({
      _id: finalUserId,
      email,
      displayName: data.user.name || 'User',
      passwordHash: passwordHash.hash,
      passwordSalt: passwordHash.salt,
      createdAt: now,
      updatedAt: now,
    });
    await profiles.insertOne({
      _id: finalUserId,
      userId: finalUserId,
      email,
      displayName: data.user.name || 'User',
      status: 'offline',
      lastSeenAt: now,
      createdAt: now,
    });
    console.log(`  Created user account: ${email} (id=${finalUserId})`);
  }

  const messages: string[] = [];
  let plansMigrated = 0;
  for (const plan of data.plans) {
    const exists = await plans.findOne({ _id: plan.id });
    if (exists) {
      messages.push(`SKIP plan ${plan.id} (already exists)`);
      continue;
    }
    const now = new Date().toISOString();
    await plans.insertOne({
      _id: plan.id,
      planType: 'personal',
      visibility: 'private',
      ownerId: finalUserId,
      title: plan.title,
      description: plan.description,
      type: plan.type,
      status: plan.status ?? PLAN_STATUS.NOT_STARTED,
      date: plan.date,
      priority: plan.priority,
      category: plan.category,
      file: plan.file ?? null,
      memberCount: 1,
      legacyId: plan.id,
      createdAt: now,
      updatedAt: now,
    });
    plansMigrated += 1;
  }

  let sessionsMigrated = 0;
  for (const session of data.sessions) {
    const now = new Date().toISOString();
    await focusSessions.insertOne({
      _id: `${finalUserId}:${session.id}`,
      userId: finalUserId,
      task: session.task,
      duration: session.duration,
      durationMinutes: parseDuration(session.duration).totalMinutes,
      date: session.date,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      actualDuration: session.actualDuration,
      legacyId: session.id,
      createdAt: now,
    });
    sessionsMigrated += 1;
  }

  const finalCounts = {
    users: existingUser ? 0 : 1,
    plans: plansMigrated,
    sessions: sessionsMigrated,
    files: data.plans.filter((p) => Boolean(p.file)).length,
  };

  const record: MigrationRecordDoc = {
    _id: `${MIGRATION_NAME}:${MIGRATION_VERSION}:${finalUserId}`,
    migrationName: MIGRATION_NAME,
    version: MIGRATION_VERSION,
    userId: finalUserId,
    sourceChecksum: checksum,
    completedAt: new Date().toISOString(),
    rowCounts: finalCounts,
  };
  await migrationRecords.insertOne(record);
  recordMigration(checksum, finalCounts);

  const report = buildReport(finalCounts, [...messages, 'INFO Migration completed successfully.']);
  const reportPath = path.join(ensureBackupsDir(), 'migration-report.txt');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(report);
  console.log(`\nReport written to ${reportPath}`);

  if (!existingUser) {
    console.log('\nWARNING: The migrated account uses the default password if --password was not provided.');
    console.log('Sign in and change your password immediately.');
  }
}

run().catch((error) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

export { resetMigrationState };
