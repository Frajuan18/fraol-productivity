import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StoredFile {
  id: string;
  originalName: string;
  storedName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  pageCount?: number;
  uploadedAt: string;
}

export interface SaveFileInput {
  planId: string | number;
  originalName: string;
  mimeType: string;
  data: Buffer;
  pageCount?: number;
}

export interface FileStorageService {
  saveFile(input: SaveFileInput): Promise<StoredFile>;
  getFileMetadata(storagePath: string): Promise<StoredFile | null>;
  openFileStream(storagePath: string): Promise<fs.ReadStream | null>;
  readFile(storagePath: string): Promise<Buffer | null>;
  deleteFile(storagePath: string): Promise<boolean>;
  deletePlanDirectory(planId: string | number): Promise<boolean>;
  resolveAbsolutePath(storagePath: string): string | null;
}

const ROOT = process.cwd();

export function storageRoot(): string {
  return path.join(ROOT, 'storage');
}

export function uploadsRoot(): string {
  return path.join(storageRoot(), 'uploads');
}

export function planUploadDir(planId: string | number): string {
  return path.join(uploadsRoot(), 'plans', String(planId));
}

export function plansUploadRoot(): string {
  return path.join(uploadsRoot(), 'plans');
}

function sanitizeExtension(originalName: string): string {
  const match = /\.([a-zA-Z0-9]{1,12})$/.exec(originalName);
  return match ? match[1].toLowerCase() : '';
}

export function generateFileId(): string {
  return crypto.randomBytes(12).toString('hex');
}

export function safeStoragePath(planId: string | number, storedName: string): string {
  return path.join('uploads', 'plans', String(planId), storedName).split(path.sep).join('/');
}

export class LocalFileStorageService implements FileStorageService {
  private resolve(storagePath: string): string {
    const root = storageRoot();
    const resolved = path.resolve(root, storagePath);
    if (!resolved.startsWith(path.resolve(root))) {
      throw new Error('INVALID_STORAGE_PATH');
    }
    return resolved;
  }

  resolveAbsolutePath(storagePath: string): string | null {
    try {
      return this.resolve(storagePath);
    } catch {
      return null;
    }
  }

  private ensurePlanDir(planId: string | number): string {
    const dir = planUploadDir(planId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async saveFile(input: SaveFileInput): Promise<StoredFile> {
    const ext = sanitizeExtension(input.originalName);
    const id = generateFileId();
    const storedName = ext ? `${id}.${ext}` : id;
    const dir = this.ensurePlanDir(input.planId);
    const absolute = path.join(dir, storedName);
    fs.writeFileSync(absolute, input.data);

    const relative = safeStoragePath(input.planId, storedName);
    return {
      id,
      originalName: input.originalName,
      storedName,
      storagePath: relative,
      mimeType: input.mimeType,
      size: input.data.length,
      pageCount: input.pageCount,
      uploadedAt: new Date().toISOString(),
    };
  }

  async getFileMetadata(storagePath: string): Promise<StoredFile | null> {
    const absolute = this.resolveAbsolutePath(storagePath);
    if (!absolute || !fs.existsSync(absolute)) return null;
    try {
      const stat = fs.statSync(absolute);
      if (!stat.isFile()) return null;
      return {
        id: path.basename(storagePath).split('.')[0],
        originalName: path.basename(storagePath),
        storedName: path.basename(storagePath),
        storagePath,
        mimeType: 'application/octet-stream',
        size: stat.size,
        uploadedAt: stat.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async openFileStream(storagePath: string): Promise<fs.ReadStream | null> {
    const absolute = this.resolveAbsolutePath(storagePath);
    if (!absolute || !fs.existsSync(absolute)) return null;
    return fs.createReadStream(absolute);
  }

  async readFile(storagePath: string): Promise<Buffer | null> {
    const absolute = this.resolveAbsolutePath(storagePath);
    if (!absolute || !fs.existsSync(absolute)) return null;
    try {
      return fs.readFileSync(absolute);
    } catch {
      return null;
    }
  }

  async deleteFile(storagePath: string): Promise<boolean> {
    const absolute = this.resolveAbsolutePath(storagePath);
    if (!absolute || !fs.existsSync(absolute)) return false;
    try {
      fs.unlinkSync(absolute);
      return true;
    } catch {
      return false;
    }
  }

  async deletePlanDirectory(planId: string | number): Promise<boolean> {
    const dir = planUploadDir(planId);
    if (!fs.existsSync(dir)) return true;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
}

export const fileStorage: FileStorageService = new LocalFileStorageService();
