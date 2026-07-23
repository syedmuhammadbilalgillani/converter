import { Injectable } from '@nestjs/common';
import { StorageService, FileMeta } from '../storage/storage.service';
import { ValidatedFile } from '../../common/pipes/file-validation.pipe';

export interface UploadResult {
  fileId: string;
  originalName: string;
  size: number;
  mimeType: string;
  width: number;
  height: number;
  channels?: number;
  hasAlpha?: boolean;
  colorSpace?: string;
  uploadedAt: string;
}

@Injectable()
export class UploadService {
  constructor(private readonly storage: StorageService) {}

  async ingest(file: ValidatedFile): Promise<UploadResult> {
    const fileId = this.storage.newFileId();
    const ext = file.detectedFormat;
    const originalPath = await this.storage.writeOriginal(fileId, ext, file.buffer);
    const uploadedAt = new Date().toISOString();

    const meta: FileMeta = {
      fileId,
      originalName: file.originalname,
      originalExt: ext,
      originalPath,
      mimeType: file.mimetype,
      size: file.size,
      width: file.width,
      height: file.height,
      channels: file.channels,
      hasAlpha: file.hasAlpha,
      colorSpace: file.colorSpace,
      uploadedAt,
    };
    await this.storage.writeMeta(meta);

    return {
      fileId,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      width: file.width,
      height: file.height,
      channels: file.channels,
      hasAlpha: file.hasAlpha,
      colorSpace: file.colorSpace,
      uploadedAt,
    };
  }
}
