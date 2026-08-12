import { NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/auth/session';
import { GRIDFS_BUCKET_NAME, getCollection } from '@/lib/mongodb/connection';
import { COLLECTIONS } from '@/lib/mongodb/collections';
import type { ConversationDoc, ImageMetadataDoc } from '@/lib/mongodb/types';
import type { Document } from 'mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GridFsFileDoc = Document & { _id: string; filename: string; contentType?: string };
type GridFsChunkDoc = Document & { files_id: string; n: number; data: { buffer: Buffer } };

/**
 * Authorised media endpoint for shared snapshots. Only a member of the snapshot's
 * conversation may read the bytes; the binary is never exposed by guessing a media id.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ mediaId: string }> }): Promise<Response> {
  const { mediaId } = await params;
  const userId = await getRequestUserId(_request);
  if (!userId) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });

  const metaCol = await getCollection<ImageMetadataDoc>(COLLECTIONS.IMAGE_METADATA);
  const meta = await metaCol.findOne({ gridFsFileId: mediaId });
  if (!meta) return NextResponse.json({ ok: false, error: 'Media not found.' }, { status: 404 });

  const conversationCol = await getCollection<ConversationDoc>(COLLECTIONS.CONVERSATIONS);
  const conversation = await conversationCol.findOne({ _id: meta.conversationId });
  if (!conversation || !conversation.memberIds.includes(userId)) {
    return NextResponse.json({ ok: false, error: 'You are not a member of this conversation.' }, { status: 403 });
  }

  const filesCol = await getCollection<GridFsFileDoc>(`${GRIDFS_BUCKET_NAME}.files`);
  const file = await filesCol.findOne({ _id: mediaId });
  if (!file) return NextResponse.json({ ok: false, error: 'Binary missing.' }, { status: 404 });

  const chunksCol = await getCollection<GridFsChunkDoc>(`${GRIDFS_BUCKET_NAME}.chunks`);
  const chunks = await chunksCol.find({ files_id: mediaId }, { sort: { n: 1 } }).toArray();
  const parts: Buffer[] = [];
  for (const chunk of chunks) {
    if (chunk?.data?.buffer instanceof Buffer) parts.push(chunk.data.buffer);
  }
  if (parts.length === 0) return NextResponse.json({ ok: false, error: 'Binary empty.' }, { status: 404 });
  const bytes = Buffer.concat(parts);

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': meta.mimeType,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
