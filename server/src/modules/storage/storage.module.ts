import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { CleanupService } from './cleanup.service';

@Global()
@Module({
  providers: [StorageService, CleanupService],
  exports: [StorageService],
})
export class StorageModule {}
