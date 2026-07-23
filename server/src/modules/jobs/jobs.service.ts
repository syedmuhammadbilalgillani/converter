import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { promises as fs } from 'fs';
import { ConvertImageDto } from '../convert/dto/convert-image.dto';
import { StorageService } from '../storage/storage.service';
import { AppException } from '../../common/errors/app.exception';
import { AppErrorCode } from '../../common/errors/error-codes';

export type JobKind = 'single' | 'batch';

export interface JobPayload {
  kind: JobKind;
  dto?: ConvertImageDto;
  dtos?: ConvertImageDto[];
}

export interface JobStatusResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
}

export const QUEUE_NAME = 'image-conversion';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(QUEUE_NAME) private readonly queue: Queue<JobPayload>,
    private readonly storage: StorageService,
  ) {}

  async enqueueSingle(dto: ConvertImageDto): Promise<string> {
    const job = await this.queue.add({ kind: 'single', dto });
    return String(job.id);
  }

  async enqueueBatch(dtos: ConvertImageDto[]): Promise<string> {
    const job = await this.queue.add({ kind: 'batch', dtos });
    return String(job.id);
  }

  async getStatus(jobId: string): Promise<JobStatusResponse> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new AppException(AppErrorCode.JOB_NOT_FOUND, `No job with id="${jobId}".`);
    }
    const state = await job.getState();
    const progress = Number(job.progress() ?? 0);
    let status: JobStatusResponse['status'];
    switch (state) {
      case 'completed':
        status = 'done';
        break;
      case 'failed':
        status = 'failed';
        break;
      case 'active':
        status = 'processing';
        break;
      default:
        status = 'queued';
    }
    return {
      jobId,
      status,
      progress: status === 'done' ? 100 : Math.floor(progress),
      result: status === 'done' ? job.returnvalue : undefined,
      error: status === 'failed' ? job.failedReason : undefined,
    };
  }

  async lookupOriginalSize(fileId: string): Promise<number | null> {
    const meta = await this.storage.readMeta(fileId);
    if (!meta) return null;
    try {
      const stat = await fs.stat(meta.originalPath);
      return stat.size;
    } catch {
      return null;
    }
  }
}
