import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FileValidationPipe, MAX_FILE_SIZE_BYTES } from '../../common/pipes/file-validation.pipe';
import type { ValidatedFile } from '../../common/pipes/file-validation.pipe';
import { UploadService, UploadResult } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async upload(@UploadedFile(FileValidationPipe) file: ValidatedFile): Promise<UploadResult> {
    return this.uploadService.ingest(file);
  }
}
