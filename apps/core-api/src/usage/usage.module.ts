/**
 * Usage Module - WI-009: Usage Persistence
 *
 * Provides PostgreSQL-backed usage metering with tenant isolation.
 * Handles high-volume event recording and background aggregation.
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsageService } from './usage.service';
import { UsageRepository } from './usage.repository';
import { UsageAggregationRunner } from './usage-aggregation.runner';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs for aggregation
  ],
  providers: [UsageService, UsageRepository, UsageAggregationRunner],
  exports: [UsageService, UsageRepository, UsageAggregationRunner],
})
export class UsageModule {}
