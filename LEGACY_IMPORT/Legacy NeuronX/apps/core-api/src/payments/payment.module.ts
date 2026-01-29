/**
 * Payment Module - WI-011: Payment Persistence
 *
 * Provides PostgreSQL-backed payment services with ACID transactions.
 * Ensures revenue-critical payment.paid events are durable and consistent.
 */

import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './payment.repository';
import { PaymentWebhookController } from './webhooks/payment-webhook.controller';
import { StripeProvider } from './providers/stripe.provider';

@Module({
  imports: [],
  controllers: [PaymentWebhookController],
  providers: [PaymentService, PaymentRepository, StripeProvider],
  exports: [PaymentService, PaymentRepository],
})
export class PaymentModule {}
