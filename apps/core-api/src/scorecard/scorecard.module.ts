/**
 * Scorecard Module - WI-065: Scorecard Engine & Analytics Integration
 *
 * Module for scorecard generation and analytics endpoints.
 */

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ScorecardService } from './scorecard.service';
import { ScorecardController } from './scorecard.controller';

@Module({
  imports: [AuditModule],
  providers: [ScorecardService],
  controllers: [ScorecardController],
  exports: [ScorecardService],
})
export class ScorecardModule {}
