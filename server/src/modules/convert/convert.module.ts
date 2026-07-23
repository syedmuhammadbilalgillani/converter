import { Module } from '@nestjs/common';
import { ConvertController } from './convert.controller';
import { ConvertService } from './convert.service';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [JobsModule],
  controllers: [ConvertController],
  providers: [ConvertService],
  exports: [ConvertService],
})
export class ConvertModule {}
