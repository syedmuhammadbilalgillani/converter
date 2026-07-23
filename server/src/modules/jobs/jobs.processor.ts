import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { ConvertService } from '../convert/convert.service';
import { JobPayload, QUEUE_NAME } from './jobs.service';

@Processor(QUEUE_NAME)
export class JobsProcessor {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(private readonly convertService: ConvertService) {}

  @Process()
  async handle(job: Job<JobPayload>) {
    const { kind } = job.data;
    if (kind === 'single' && job.data.dto) {
      const r = await this.convertService.convert(job.data.dto);
      await job.progress(100);
      return r;
    }
    if (kind === 'batch' && job.data.dtos) {
      const dtos = job.data.dtos;
      const total = dtos.length;
      const results = await Promise.allSettled(
        dtos.map(async (dto, i) => {
          const r = await this.convertService.convert(dto);
          await job.progress(Math.floor(((i + 1) / total) * 100));
          return r;
        }),
      );
      return results.map((r) =>
        r.status === 'fulfilled'
          ? { status: 'fulfilled' as const, value: r.value }
          : { status: 'rejected' as const, reason: String(r.reason?.message ?? r.reason) },
      );
    }
    this.logger.warn(`Unknown job payload: ${JSON.stringify(job.data)}`);
    throw new Error('Invalid job payload');
  }
}
