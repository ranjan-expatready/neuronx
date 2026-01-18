import { Module } from '@nestjs/common';
import { EventBus } from '@neuronx/eventing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService, EventBus],
  exports: [WebhookService],
})
export class WebhookModule {}
