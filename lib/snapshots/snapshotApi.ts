import type { Message, ZipExportResult } from '@/src/types/collaboration';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/** Uploads an image snapshot into the shared chat (multipart, authenticated). */
export async function uploadSnapshot(file: File, caption: string | null): Promise<Message> {
  const form = new FormData();
  form.append('file', file);
  if (caption) form.append('caption', caption);
  const response = await fetch('/api/snapshots/upload', { method: 'POST', body: form });
  const body = (await response.json().catch(() => ({}))) as ApiResponse<Message>;
  if (!response.ok || !body.ok) {
    const err = new Error(body.error || 'Upload failed.') as Error & { code?: string };
    if (body.code) err.code = body.code;
    throw err;
  }
  return body.data as Message;
}

/** Triggers a browser download of the exported snapshots ZIP from the server-produced base64. */
export function downloadZip(result: ZipExportResult): void {
  const binary = atob(result.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
