export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const ALLOWED_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
};

export const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/msword': 'Word',
  'text/plain': 'Text',
};

export function getExtensionForMime(mimeType: string): string | null {
  return ALLOWED_FILE_TYPES[mimeType] ?? null;
}

export function isAllowedFileType(mimeType: string): boolean {
  return getExtensionForMime(mimeType) !== null;
}

export function isWithinSizeLimit(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

function isPdf(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2d;
}

export function detectMimeType(buffer: Buffer): string {
  if (isPdf(buffer)) return 'application/pdf';
  return 'application/octet-stream';
}

/**
 * Extracts the page count from a PDF by scanning the trailer for the Pages
 * catalog. Works on the tail of the file (page count lives at the end). Returns
 * null when the count cannot be determined.
 */
export function countPdfPages(buffer: Buffer): number | null {
  if (!isPdf(buffer)) return null;

  const tail = buffer.length > 300000 ? buffer.subarray(buffer.length - 300000) : buffer;
  const tailString = tail.toString('latin1');

  const pageCatalog = /\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/i.exec(tailString);
  if (pageCatalog && pageCatalog[1]) {
    const count = parseInt(pageCatalog[1], 10);
    if (!isNaN(count)) return count;
  }

  return null;
}

export function parsePlanId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}
