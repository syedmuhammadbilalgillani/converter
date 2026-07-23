import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { promises as fs } from 'fs';
import { StorageService } from './storage.service';

const MAX_AGE_MS = 60 * 60 * 1000;

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly storage: StorageService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async sweep(): Promise<void> {
    const now = Date.now();
    let removed = 0;
    try {
      const dirs = await this.storage.listAllDirs();
      for (const d of dirs) {
        if (now - d.mtime.getTime() > MAX_AGE_MS) {
          await fs.rm(d.fullPath, { recursive: true, force: true });
          removed++;
        }
      }
    } catch (err) {
      this.logger.warn(`Cleanup sweep failed: ${(err as Error).message}`);
      return;
    }
    if (removed > 0) this.logger.log(`Cleaned up ${removed} expired upload dirs.`);
  }
}
