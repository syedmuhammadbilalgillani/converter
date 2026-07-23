import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConvertImageDto, OutputFormat } from './dto/convert-image.dto';
import { ConvertService } from './convert.service';
import { JobsService } from '../jobs/jobs.service';
import { AppException } from '../../common/errors/app.exception';
import { AppErrorCode } from '../../common/errors/error-codes';

const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;

@Controller('convert')
export class ConvertController {
  constructor(
    private readonly convertService: ConvertService,
    private readonly jobsService: JobsService,
  ) {}

  @Post()
  async convert(@Body() dto: ConvertImageDto) {
    const size = await this.jobsService.lookupOriginalSize(dto.fileId);
    if (size !== null && size > LARGE_FILE_THRESHOLD) {
      const jobId = await this.jobsService.enqueueSingle(dto);
      return { jobId, status: 'queued' as const };
    }
    return this.convertService.convert(dto);
  }

  @Post('batch')
  async batch(@Body() body: { jobs: ConvertImageDto[] }) {
    if (!Array.isArray(body?.jobs) || body.jobs.length === 0) {
      throw new AppException(
        AppErrorCode.BATCH_TOO_LARGE,
        'Batch must include at least one job.',
      );
    }
    if (body.jobs.length > 20) {
      throw new AppException(
        AppErrorCode.BATCH_TOO_LARGE,
        'Batch is limited to 20 items.',
      );
    }

    // Check if any file exceeds the large-file threshold — if so, queue the whole batch.
    const sizes = await Promise.all(
      body.jobs.map((dto) => this.jobsService.lookupOriginalSize(dto.fileId)),
    );
    const needsQueue = sizes.some((s) => s !== null && s > LARGE_FILE_THRESHOLD);

    if (needsQueue) {
      const jobId = await this.jobsService.enqueueBatch(body.jobs);
      return { jobId, status: 'queued' as const, count: body.jobs.length };
    }

    // Process inline and return results immediately (no Redis required).
    const settled = await Promise.allSettled(
      body.jobs.map((dto) => this.convertService.convert(dto)),
    );
    return settled.map((r) =>
      r.status === 'fulfilled'
        ? { status: 'fulfilled' as const, value: r.value }
        : { status: 'rejected' as const, reason: (r.reason as Error)?.message ?? String(r.reason) },
    );
  }

  @Post('pdf')
  async mergePdf(
    @Body() body: { fileIds: string[] } & Omit<ConvertImageDto, 'fileId' | 'outputFormat'>,
  ) {
    if (!Array.isArray(body?.fileIds) || body.fileIds.length === 0) {
      throw new AppException(
        AppErrorCode.CONVERSION_FAILED,
        'Provide at least one fileId to build a PDF.',
      );
    }
    if (body.fileIds.length > 50) {
      throw new AppException(
        AppErrorCode.BATCH_TOO_LARGE,
        'PDF merge is limited to 50 pages.',
      );
    }
    const { fileIds, ...opts } = body;
    return this.convertService.convertToPdf(fileIds, {
      ...opts,
      outputFormat: OutputFormat.PDF,
    });
  }

  @Get('preview/:fileId')
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'no-store')
  async preview(@Param('fileId') fileId: string, @Res() res: Response) {
    const buf = await this.convertService.getPreviewBuffer(fileId);
    res.send(buf);
  }
}
