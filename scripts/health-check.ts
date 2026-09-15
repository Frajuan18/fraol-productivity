/**
 * Quick MongoDB health check. Run with: npx tsx scripts/health-check.ts
 *
 * Verifies:
 * 1. MONGODB_URI is set
 * 2. Can connect to the cluster
 * 3. Can read/write to the configured database
 * 4. Lists existing collections
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

  console.log(`Health check: database="${dbName}"`);
  console.log('Connecting...');

  const client = new MongoClient(uri, {
    appName: 'mywhiteboard-healthcheck',
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas.');

    const db = client.db(dbName);

    // Ping
    await db.command({ ping: 1 });
    console.log('Ping: OK');

    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`Collections in "${dbName}": ${collections.length === 0 ? '(none yet — created on first write)' : ''}`);
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments({});
      console.log(`  - ${col.name}: ${count} document(s)`);
    }

    // Write test
    const testCol = db.collection<{ _id: string; ok: boolean; at: string }>('_healthCheck');
    const testDoc = { _id: 'healthCheck', ok: true, at: new Date().toISOString() };
    await testCol.updateOne({ _id: 'healthCheck' } as never, { $set: testDoc } as never, { upsert: true });
    const readBack = await testCol.findOne({ _id: 'healthCheck' } as never);
    if (readBack?.ok) {
      console.log('Write/read test: OK');
    } else {
      console.error('Write/read test: FAILED (document not found after upsert)');
      process.exit(1);
    }
    await testCol.deleteOne({ _id: 'healthCheck' } as never);

    console.log('\nAll checks passed.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FAIL: ${message}`);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
