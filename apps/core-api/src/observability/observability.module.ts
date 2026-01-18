/**
 * Observability Module - WI-024: Observability & Metrics Foundation
 *
 * Wires together metrics collection, health checks, and monitoring.
 */

import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MetricsController } from './metrics.controller';
import { HealthController } from './health.controller';
import { ReadinessService } from './readiness.service';
import { MetricsCollector } from './metrics.collector';
import { OutboxRepository } from '../eventing/outbox.repository';
import { WebhookRepository } from '../webhooks/webhook.repository';
import { SlaTimerRepository } from '../sla/sla-timer.repository';
import { VoiceAttemptRepository } from '../voice/voice-attempt.repository';
import { FeatureFlagsService } from '../config/feature-flags.service';

@Global()
@Module({
  imports: [
    // Enable cron scheduling for metrics collection
    ScheduleModule.forRoot(),
  ],
  controllers: [
    MetricsController, // /metrics endpoint
    HealthController, // /health endpoints
  ],
  providers: [
    // Readiness service for health checks
    ReadinessService,

    // Metrics collector for periodic backlog updates (uses @Interval decorator)
    MetricsCollector,

    // Repositories needed by metrics collector
    OutboxRepository,
    WebhookRepository,
    SlaTimerRepository,
    VoiceAttemptRepository,
  ],
  exports: [ReadinessService, MetricsCollector],
})
export class ObservabilityModule {}
