import '@/lib/server-only';
import { MongoClient, GridFSBucket, type Db, type Collection, type Document } from 'mongodb';
import { getServerEnv } from '@/lib/configServer';

export const GRIDFS_BUCKET_NAME = 'chatSnapshots';

const env = getServerEnv();

interface MongoHandle {
  client: MongoClient;
  db: Db;
  bucket: GridFSBucket;
}

/**
 * Global cache survives Next.js dev hot reload so the process does not open a second
 * connection to MongoDB on every module reload.
 */
const globalForMongo = globalThis as unknown as { __mwMongo?: Promise<MongoHandle> };

export function isMongoConfigured(): boolean {
  return env.mongoConfigured;
}

async function connect(): Promise<MongoHandle> {
  const uri = env.mongodbUri;
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not configured. Set MONGODB_URI (and optionally MONGODB_DATABASE) in your environment. The application keeps running in local JSON mode until then.',
    );
  }

  // The URI may contain credentials — only ever log the database/connection target, never the URI itself.
  const client = new MongoClient(uri, {
    appName: 'mywhiteboard',
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Failed to connect to MongoDB (${error instanceof Error ? error.message : 'unknown error'}). Credentials are never logged.`,
    );
  }

  const db = client.db(env.mongodbDatabase);
  const bucket = new GridFSBucket(db, { bucketName: GRIDFS_BUCKET_NAME });
  return { client, db, bucket };
}

export async function getMongoDb(): Promise<Db> {
  const handle = await getMongoHandle();
  return handle.db;
}

export async function getMongoClient(): Promise<MongoClient> {
  const handle = await getMongoHandle();
  return handle.client;
}

export async function getGridFSBucket(): Promise<GridFSBucket> {
  const handle = await getMongoHandle();
  return handle.bucket;
}

export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getMongoDb();
  return db.collection<T>(name);
}

function getMongoHandle(): Promise<MongoHandle> {
  if (!isMongoConfigured()) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI to enable cloud storage.');
  }
  if (!globalForMongo.__mwMongo) {
    globalForMongo.__mwMongo = connect();
  }
  return globalForMongo.__mwMongo;
}

export async function closeMongoConnection(): Promise<void> {
  const handle = await globalForMongo.__mwMongo;
  if (handle) {
    await handle.client.close();
    globalForMongo.__mwMongo = undefined;
  }
}

/** Called from the Next.js runtime shutdown hook; safe to call multiple times. */
export async function shutdownMongo(): Promise<void> {
  try {
    await closeMongoConnection();
  } catch {
    // best-effort shutdown
  }
}
