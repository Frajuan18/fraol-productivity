import { NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/auth/session';
import { getGridFSBucket } from '@/lib/mongodb/connection';
import { createMongoDbRepository } from '@/lib/repositories/mongodb/MongoDbProductivityRepository';
import { toErrorResponse } from '@/lib/repositories/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SNAPSHOT_BYTES = 15 * 1024 * 1024;

/**
 * Multipart upload for shared snapshots. The user's partner is resolved from the session,
 * the snapshot is stored in the `chatSnapshots` GridFS bucket and attached to the shared
 * chat. Uploads are rejected whenever the sender disabled snapshot sharing.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await getRequestUserId(request);
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const repository = createMongoDbRepository();
    if (!repository) {
      return NextResponse.json({ ok: false, error: 'Snapshots require MongoDB mode.' }, { status: 503 });
    }

    const partner = await repository.getPartner(userId);
    if (!partner) {
      return NextResponse.json({ ok: false, error: 'No configured partnership.' }, { status: 404 });
    }

    const privacy = await repository.getPrivacySettings(userId);
    if (privacy.shareSnapshots === false) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Snapshot sharing is disabled. Enable it in Partner privacy to share snapshots.',
          code: 'SNAPSHOTS_DISABLED',
        },
        { status: 403 },
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file provided.' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'Only image snapshots can be shared.' }, { status: 400 });
    }
    if (file.size > MAX_SNAPSHOT_BYTES) {
      return NextResponse.json({ ok: false, error: 'Snapshots are limited to 15 MB.' }, { status: 400 });
    }

    const caption =
      typeof form.get('caption') === 'string' && form.get('caption') ? String(form.get('caption')).trim() : null;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaId = crypto.randomUUID();

    const bucket = await getGridFSBucket();
    await new Promise<void>((resolve, reject) => {
      const upload = bucket.openUploadStreamWithId(mediaId as never, file.name, {
        metadata: { contentType: file.type },
      });
      upload.on('error', reject);
      upload.on('finish', () => resolve());
      upload.end(bytes, (error?: Error | null) => {
        if (error) reject(error);
      });
    });

    await repository.saveMedia({
      id: mediaId,
      messageId: '',
      conversationId: partner.conversation.id,
      ownerId: userId,
      fileName: file.name,
      mimeType: file.type,
      size: bytes.length,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    const message = await repository.saveSnapshot(userId, partner.conversation.id, {
      mediaId,
      fileName: file.name,
      mimeType: file.type,
      size: bytes.length,
      caption,
    });

    return NextResponse.json({ ok: true, data: message });
  } catch (error) {
    const { message, code, status } = toErrorResponse(error);
    return NextResponse.json({ ok: false, error: message, code }, { status });
  }
}
