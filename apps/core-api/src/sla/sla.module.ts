import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlaService } from './sla.service';
import { EscalationService } from './escalation.service';
import { EscalationHandler } from './escalation.handler';
import { SlaTimerRepository } from './sla-timer.repository';
import { SlaTimerRunner } from './sla-timer.runner';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';
import { EventingModule } from '../eventing/eventing.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs for SLA timer processing
    ConfigModule,
    AuditModule,
    EventingModule, // For durable event publishing
  ],
  providers: [
    SlaService,
    EscalationService,
    EscalationHandler,
    SlaTimerRepository,
    SlaTimerRunner,
  ],
  exports: [SlaService, EscalationService],
})
export class SlaModule {}
