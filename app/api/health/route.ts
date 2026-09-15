import { NextResponse } from 'next/server';
import { isMongoConfigured, getCollection } from '@/lib/mongodb/connection';

export async function GET() {
  if (!isMongoConfigured()) {
    return NextResponse.json({
      ok: false,
      status: 'not_configured',
      message: 'MongoDB is not configured. Set MONGODB_URI in .env.local.',
    });
  }

  try {
    const col = await getCollection<{ _id: unknown }>('users');
    const count = await col.countDocuments({});
    return NextResponse.json({
      ok: true,
      status: 'connected',
      message: `MongoDB connected. ${count} user(s) found.`,
      userCount: count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connection error';
    return NextResponse.json({
      ok: false,
      status: 'error',
      message: `MongoDB connection failed: ${message}`,
    });
  }
}
