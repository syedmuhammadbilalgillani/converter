import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { StorageModule } from './modules/storage/storage.module';
import { UploadModule } from './modules/upload/upload.module';
import { ConvertModule } from './modules/convert/convert.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { DownloadModule } from './modules/download/download.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: (Number(process.env.RATE_LIMIT_TTL) || 60) * 1000,
        limit: Number(process.env.RATE_LIMIT_MAX) || 60,
      },
    ]),
    BullModule.forRoot({
      redis: process.env.REDIS_URL
        ? { ...parseRedisUrl(process.env.REDIS_URL) }
        : { host: '127.0.0.1', port: 6379 },
    }),
    StorageModule,
    UploadModule,
    JobsModule,
    ConvertModule,
    DownloadModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalHttpExceptionFilter },
  ],
})
export class AppModule {}

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 6379,
    password: u.password || undefined,
  };
}
