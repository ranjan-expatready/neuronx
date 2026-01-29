import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VoiceService } from './voice.service';
import { EscalationService } from './escalation.service';
import { EscalationHandler } from './escalation.handler';
import { VoiceAttemptRepository } from './voice-attempt.repository';
import { VoiceAttemptRunner } from './voice-attempt.runner';
import { VoiceExecutionController } from './voice-execution.controller';
import { VoiceEvidenceNormalizer } from './voice-evidence.normalizer';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';
import { EventingModule } from '../eventing/eventing.module';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs for voice retry processing
    ConfigModule,
    AuditModule,
    EventingModule, // For durable event publishing
    SalesModule, // For playbook enforcer access
  ],
  controllers: [VoiceExecutionController],
  providers: [
    VoiceService,
    EscalationService,
    EscalationHandler,
    VoiceAttemptRepository,
    VoiceAttemptRunner,
    VoiceEvidenceNormalizer,
  ],
  exports: [VoiceService, EscalationService, VoiceEvidenceNormalizer],
})
export class VoiceModule {}
