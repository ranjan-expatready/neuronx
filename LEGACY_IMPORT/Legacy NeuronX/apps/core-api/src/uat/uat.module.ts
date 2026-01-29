/**
 * UAT Module - WI-066: UAT Harness + Seed + Safety
 *
 * Provides UAT safety infrastructure for the core API.
 * Includes guards, middleware, and services for safe testing.
 */

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { UatGuard } from './uat.guard';
import { GlobalUatBoundaryGuard } from './global-uat-boundary.guard';
import { UatService } from './uat.service';
import { UatController } from './uat.controller';
import { GoldenRunService } from './golden-run.service';
import { GoldenRunController } from './golden-run.controller';

@Module({
  imports: [AuditModule],
  providers: [
    UatGuard,
    GlobalUatBoundaryGuard,
    UatService,
    GoldenRunService,
    // Register global UAT boundary guard for ALL routes
    {
      provide: APP_GUARD,
      useClass: GlobalUatBoundaryGuard,
    },
  ],
  controllers: [UatController, GoldenRunController],
  exports: [UatGuard, UatService],
})
export class UatModule {}
