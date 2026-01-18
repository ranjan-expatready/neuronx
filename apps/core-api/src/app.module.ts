import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventingModule } from './eventing/eventing.module';
import { SalesModule } from './sales/sales.module';
import { SlaModule } from './sla/sla.module';
import { PaymentModule } from './payments/payment.module';
import { EntitlementModule } from './config/entitlements/entitlement.module';
import { ConfigPersistenceModule } from './config/config.module';
import { UsageModule } from './usage/usage.module';
import { GhlIntegrationModule } from './integrations/ghl/ghl.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { CacheModule } from './cache/cache.module';
import { WebhookModule } from './webhooks/webhook.module';
import { SecretsModule } from './secrets/secrets.module';
import { StorageModule } from './storage/storage.module';
import { AuthzModule } from './authz/authz.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { ObservabilityModule } from './observability/observability.module';
import { VoiceModule } from './voice/voice.module';
import { ExecutionModule } from './execution/execution.module';
import { OrgAuthorityModule } from './org-authority/org-authority.module';
import { ConfigModule } from './config/config.module';
import { ReadinessModule } from './readiness/readiness.module';
import { UiModule } from './ui/ui.module';
import { UatModule } from './uat/uat.module';
import { ScorecardModule } from './scorecard/scorecard.module';
import { GhlReadModule } from './ghl-read/ghl-read.module';

@Module({
  imports: [
    ConfigModule, // Boot-time configuration validation
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AuthzModule, // Access control & API key governance
    MaintenanceModule, // Data retention & cleanup runners
    EventingModule,
    SalesModule,
    SlaModule,
    PaymentModule, // Revenue-critical payment services
    EntitlementModule, // Entitlement management with persistence
    ConfigPersistenceModule, // Configuration persistence with IP protection
    UsageModule, // Usage metering with persistence
    GhlIntegrationModule,
    VoiceModule, // Voice execution and evidence normalization (WI-033)
    ExecutionModule, // Multi-channel execution authority (WI-034)
    OrgAuthorityModule, // Organization authority model (WI-035)
    RateLimitModule, // Global rate limiting
    CacheModule, // Redis-backed ML/scoring cache
    SecretsModule, // Secure secret management foundation
    WebhookModule, // Outbound webhook delivery system
    StorageModule, // Object storage & artifact management
    ObservabilityModule, // Metrics and health endpoints
    ReadinessModule, // Production readiness dashboard (WI-054)
    UiModule, // UI infrastructure & governance (WI-061)
    UatModule, // UAT harness + seed + safety (WI-066)
    ScorecardModule, // Scorecard engine & analytics integration (WI-065)
    GhlReadModule, // GHL read-only data integration (WI-070)
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
