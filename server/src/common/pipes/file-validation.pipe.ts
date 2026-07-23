import { Injectable, PipeTransform } from '@nestjs/common';
import sharp from 'sharp';
import { AppException } from '../errors/app.exception';
import { AppErrorCode } from '../errors/error-codes';

export const ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'image/avif',
  'image/heic',
  'image/heif',
] as const;

export const MAX_FILE_SIZE_BYTES =
  (Number(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;

export interface ValidatedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  detectedFormat: string;
  width: number;
  height: number;
  channels?: number;
  hasAlpha?: boolean;
  colorSpace?: string;
}

@Injectable()
export class FileValidationPipe
  implements PipeTransform<Express.Multer.File | undefined, Promise<ValidatedFile>>
{
  async transform(file: Express.Multer.File | undefined): Promise<ValidatedFile> {
    if (!file) {
      throw new AppException(
        AppErrorCode.FILE_NOT_FOUND,
        'No file was provided in the request.',
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new AppException(
        AppErrorCode.FILE_TOO_LARGE,
        `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      );
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.mimetype as (typeof ACCEPTED_MIME_TYPES)[number])) {
      throw new AppException(
        AppErrorCode.UNSUPPORTED_FORMAT,
        `MIME type "${file.mimetype}" is not a supported image format.`,
      );
    }

    let meta: sharp.Metadata;
    try {
      meta = await sharp(file.buffer, { failOn: 'error' }).metadata();
    } catch {
      throw new AppException(
        AppErrorCode.UNSUPPORTED_FORMAT,
        'The uploaded file is not a valid image (magic bytes mismatch).',
      );
    }

    if (!meta.format || !meta.width || !meta.height) {
      throw new AppException(
        AppErrorCode.UNSUPPORTED_FORMAT,
        'Could not decode image metadata.',
      );
    }

    return {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      detectedFormat: meta.format,
      width: meta.width,
      height: meta.height,
      channels: meta.channels,
      hasAlpha: meta.hasAlpha,
      colorSpace: meta.space,
    };
  }
}
