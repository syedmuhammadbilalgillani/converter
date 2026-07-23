import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { JobsController } from './jobs.controller';
import { JobsService, QUEUE_NAME } from './jobs.service';
import { JobsProcessor } from './jobs.processor';
import { ConvertService } from '../convert/convert.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAME })],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor, ConvertService],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
