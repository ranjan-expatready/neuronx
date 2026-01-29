/**
 * Work Queue Module - WI-037: Opportunity → Team Binding
 */

import { Module } from '@nestjs/common';
import { WorkQueueService } from './work-queue.service';
import { WorkQueueController } from './work-queue.controller';
import { OrgAuthorityModule } from '../org-authority/org-authority.module';

@Module({
  imports: [OrgAuthorityModule],
  providers: [WorkQueueService],
  controllers: [WorkQueueController],
  exports: [WorkQueueService],
})
export class WorkQueueModule {}
