import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { StorageService } from '../storage/storage.service';
import { AppException } from '../../common/errors/app.exception';
import { AppErrorCode } from '../../common/errors/error-codes';
import { FORMAT_MIME } from '../convert/convert.service';
import { OutputFormat } from '../convert/dto/convert-image.dto';

const TEN_MINUTES_MS = 10 * 60 * 1000;

@Controller('download')
export class DownloadController {
  constructor(private readonly storage: StorageService) {}

  @Get(':fileId')
  async download(@Param('fileId') fileId: string, @Res() res: Response) {
    const meta = await this.storage.readMeta(fileId);
    if (!meta?.lastOutput) {
      throw new AppException(
        AppErrorCode.FILE_NOT_FOUND,
        `No converted output for fileId="${fileId}".`,
      );
    }
    const { path, fileName, format } = meta.lastOutput;
    const mime = FORMAT_MIME[format as OutputFormat] ?? 'application/octet-stream';

    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName.replace(/"/g, '')}"`,
    );

    const stream = createReadStream(path);
    stream.pipe(res);
    stream.on('end', () => {
      this.storage.scheduleDelete(fileId, TEN_MINUTES_MS);
    });
    stream.on('error', (err) => {
      res.destroy(err);
    });
  }
}
