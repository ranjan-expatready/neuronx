/**
 * Webhook Module - WI-018: Outbound Webhook Delivery System
 *
 * Provides tenant-isolated, durable webhook delivery with HMAC signing and retry logic.
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SecretsModule } from '../secrets/secrets.module';
import { WebhookService } from './webhook.service';
import { WebhookRepository } from './webhook.repository';
import { WebhookDispatcher } from './webhook.dispatcher';
import { WebhookSigner } from './webhook.signer';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs for webhook processing
    SecretsModule, // Required for secure secret retrieval
  ],
  controllers: [
    WebhookController, // WI-020: Management APIs
  ],
  providers: [
    WebhookService,
    WebhookRepository,
    WebhookDispatcher,
    WebhookSigner,
  ],
  exports: [
    WebhookService,
    WebhookRepository, // For direct access if needed
  ],
})
export class WebhookModule {}
