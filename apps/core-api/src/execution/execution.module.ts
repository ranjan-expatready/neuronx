/**
 * Execution Module - WI-034: Multi-Channel Execution Authority
 */

import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import {
  ExecutionTokenRepository,
  IdempotencyRecordRepository,
} from './execution.repository';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ConfigModule, AuditModule],
  controllers: [ExecutionController],
  providers: [
    ExecutionService,
    ExecutionTokenRepository,
    IdempotencyRecordRepository,
  ],
  exports: [ExecutionService],
})
export class ExecutionModule {}
