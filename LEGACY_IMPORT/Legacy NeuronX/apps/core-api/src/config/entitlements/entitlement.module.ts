/**
 * Entitlement Module - WI-010: Entitlement Persistence
 *
 * Provides PostgreSQL-backed entitlement management with ACID transactions.
 * Handles tier definitions, tenant entitlements, transitions, and lifecycle enforcement.
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EntitlementService } from './entitlement.service';
import { EntitlementRepository } from './entitlement.repository';
import { ScheduledActionRunner } from './scheduled-action.runner';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs for scheduled actions
  ],
  providers: [EntitlementService, EntitlementRepository, ScheduledActionRunner],
  exports: [EntitlementService, EntitlementRepository, ScheduledActionRunner],
})
export class EntitlementModule {}
