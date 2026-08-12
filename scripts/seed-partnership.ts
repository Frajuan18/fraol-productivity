/**
 * Seed the preconfigured fixed partnership.
 *
 * Usage:
 *   npm run partner:seed -- --user-a partner-a@example.com --user-b partner-b@example.com
 *
 * The partner relationship is a single fixed MongoDB document (relationshipType
 * 'fixed_partner', status 'active') between the two accounts. There is no invitation
 * flow: the backend derives the partner from the authenticated session and verifies the
 * signed-in user belongs to this pair before returning any partner data. The seed is
 * idempotent and never touches storage/data.json.
 */
import './loadEnv';
import { isMongoConfigured, getMongoDb } from '@/lib/mongodb/connection';
import { COLLECTIONS } from '@/lib/mongodb/collections';
import { ensureIndexes } from '@/lib/mongodb/indexes';
import { DEFAULT_PARTNER_PRIVACY } from '@/lib/repositories/ProductivityRepository';
import type {
  ConversationDoc,
  PartnershipDoc,
  PrivacyDoc,
  ProfileDoc,
  UserDoc,
} from '@/lib/mongodb/types';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
    if (value !== '') {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const emailA = (args['user-a'] || args['email-a'] || '').trim().toLowerCase();
  const emailB = (args['user-b'] || args['email-b'] || '').trim().toLowerCase();

  if (!emailA || !emailB) {
    console.error('Both --user-a <email> and --user-b <email> are required.');
    process.exit(1);
  }
  if (emailA === emailB) {
    console.error('The two accounts must be different.');
    process.exit(1);
  }
  if (!isMongoConfigured()) {
    console.error('MONGODB_URI is not configured. Set it in your environment before seeding.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB and ensuring indexes ...');
  const db = await getMongoDb();
  const indexes = await ensureIndexes();
  console.log(`  Indexes ensured (${indexes.length}).`);

  const users = db.collection<UserDoc>(COLLECTIONS.USERS);
  const profiles = db.collection<ProfileDoc>(COLLECTIONS.PROFILES);
  const partnerships = db.collection<PartnershipDoc>(COLLECTIONS.PARTNERSHIPS);
  const privacySettings = db.collection<PrivacyDoc>(COLLECTIONS.PARTNER_PRIVACY_SETTINGS);
  const conversations = db.collection<ConversationDoc>(COLLECTIONS.CONVERSATIONS);

  const userA = await users.findOne({ email: emailA });
  const userB = await users.findOne({ email: emailB });
  if (!userA) {
    console.error(`No account found for "${emailA}". Register the account first.`);
    process.exit(1);
  }
  if (!userB) {
    console.error(`No account found for "${emailB}". Register the account first.`);
    process.exit(1);
  }

  const now = new Date().toISOString();

  // Ensure a profile exists for each account (mirrors the register route).
  for (const user of [userA, userB]) {
    const existing = await profiles.findOne({ userId: user._id });
    if (!existing) {
      await profiles.insertOne({
        _id: user._id,
        userId: user._id,
        email: user.email,
        displayName: user.displayName,
        status: 'offline',
        lastSeenAt: now,
        createdAt: now,
      });
      console.log(`  Created profile for ${user.email}.`);
    }
  }

  // Canonical order so the unique (userAId, userBId) index never sees a duplicate pair.
  const [primary, secondary] =
    userA._id.localeCompare(userB._id) <= 0 ? [userA, userB] : [userB, userA];

  const existingPartnership = await partnerships.findOne({
    $or: [
      { userAId: primary._id, userBId: secondary._id },
      { userAId: secondary._id, userBId: primary._id },
    ],
  });

  let partnershipId: string;
  if (existingPartnership) {
    if (existingPartnership.relationshipType === 'fixed_partner' && existingPartnership.status === 'active') {
      partnershipId = existingPartnership._id;
      console.log(`  Fixed partnership already active (${partnershipId}). Nothing to do.`);
    } else {
      await partnerships.updateOne(
        { _id: existingPartnership._id },
        { $set: { status: 'active', relationshipType: 'fixed_partner', updatedAt: now } },
      );
      partnershipId = existingPartnership._id;
      console.log(`  Upgraded existing partnership (${partnershipId}) to fixed_partner / active.`);
    }
  } else {
    const doc: PartnershipDoc = {
      _id: crypto.randomUUID(),
      userAId: primary._id,
      userBId: secondary._id,
      status: 'active',
      relationshipType: 'fixed_partner',
      invitedBy: primary._id,
      createdAt: now,
      updatedAt: now,
    };
    await partnerships.insertOne(doc);
    partnershipId = doc._id;
    console.log(`  Created fixed partnership ${partnershipId}.`);
  }

  // Default privacy settings for both members (opt-in sharing).
  for (const user of [userA, userB]) {
    const existingPrivacy = await privacySettings.findOne({ userId: user._id });
    if (!existingPrivacy) {
      await privacySettings.insertOne({
        _id: user._id,
        userId: user._id,
        ...DEFAULT_PARTNER_PRIVACY,
        updatedAt: now,
      });
      console.log(`  Created default privacy settings for ${user.email}.`);
    }
  }

  // Ensure the pair conversation exists.
  const existingConversation = await conversations.findOne({ partnershipId });
  if (!existingConversation) {
    await conversations.insertOne({
      _id: crypto.randomUUID(),
      partnershipId,
      memberIds: [primary._id, secondary._id],
      createdAt: now,
    });
    console.log(`  Created conversation for partnership ${partnershipId}.`);
  }

  console.log('\nFixed partnership seeded successfully.');
  console.log(`  userAId:        ${primary._id} (${primary.email})`);
  console.log(`  userBId:        ${secondary._id} (${secondary.email})`);
  console.log(`  partnershipId:  ${partnershipId}`);
  console.log('\nBoth users can now sign in and open the Partner workspace.');
}

run().catch((error) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
