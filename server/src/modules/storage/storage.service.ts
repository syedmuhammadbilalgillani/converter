import { Injectable, Logger } from '@nestjs/common';
import { promises as fs, existsSync, mkdirSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface FileMeta {
  fileId: string;
  originalName: string;
  originalExt: string;
  originalPath: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  channels?: number;
  hasAlpha?: boolean;
  colorSpace?: string;
  uploadedAt: string;
  lastOutput?: {
    format: string;
    path: string;
    size: number;
    fileName: string;
    convertedAt: string;
  };
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly root: string;

  constructor() {
    this.root =
      process.env.UPLOAD_DIR ?? path.join(os.tmpdir(), 'image-converter-uploads');
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
    this.logger.log(`Storage root: ${this.root}`);
  }

  newFileId(): string {
    return randomUUID();
  }

  dirFor(fileId: string): string {
    return path.join(this.root, fileId);
  }

  metaPath(fileId: string): string {
    return path.join(this.dirFor(fileId), 'meta.json');
  }

  async ensureDir(fileId: string): Promise<string> {
    const dir = this.dirFor(fileId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async writeMeta(meta: FileMeta): Promise<void> {
    await fs.writeFile(this.metaPath(meta.fileId), JSON.stringify(meta, null, 2), 'utf8');
  }

  async readMeta(fileId: string): Promise<FileMeta | null> {
    try {
      const raw = await fs.readFile(this.metaPath(fileId), 'utf8');
      return JSON.parse(raw) as FileMeta;
    } catch {
      return null;
    }
  }

  async writeOriginal(fileId: string, ext: string, buffer: Buffer): Promise<string> {
    const dir = await this.ensureDir(fileId);
    const dest = path.join(dir, `original.${ext}`);
    await fs.writeFile(dest, buffer);
    return dest;
  }

  outputPath(fileId: string, format: string): string {
    return path.join(this.dirFor(fileId), `output.${format}`);
  }

  async deleteDir(fileId: string): Promise<void> {
    await fs.rm(this.dirFor(fileId), { recursive: true, force: true });
  }

  scheduleDelete(fileId: string, delayMs: number): void {
    setTimeout(() => {
      this.deleteDir(fileId).catch((err) =>
        this.logger.warn(`Failed to cleanup ${fileId}: ${err}`),
      );
    }, delayMs).unref?.();
  }

  async listAllDirs(): Promise<{ name: string; fullPath: string; mtime: Date }[]> {
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const out: { name: string; fullPath: string; mtime: Date }[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const fullPath = path.join(this.root, e.name);
      const stat = await fs.stat(fullPath);
      out.push({ name: e.name, fullPath, mtime: stat.mtime });
    }
    return out;
  }
}
