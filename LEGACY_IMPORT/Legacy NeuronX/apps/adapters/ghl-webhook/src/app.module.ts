import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InMemoryEventBus } from '@neuronx/eventing';
import { EventBus } from '@neuronx/eventing';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    WebhookModule,
  ],
  providers: [
    {
      provide: EventBus,
      useClass: InMemoryEventBus,
    },
  ],
  exports: [EventBus],
})
export class AppModule {}
