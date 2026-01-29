import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InMemoryEventBus } from '@neuronx/eventing';
import { EventBus } from '@neuronx/eventing';
import { OutboxRepository } from './outbox.repository';
import { DurableEventPublisherService } from './durable-event-publisher';
import { OutboxDispatcher, NoopEventTransport } from './outbox-dispatcher';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs for outbox processing
  ],
  providers: [
    // Legacy in-memory event bus for backward compatibility
    {
      provide: EventBus,
      useClass: InMemoryEventBus,
    },

    // New durable event publishing infrastructure
    OutboxRepository,
    DurableEventPublisherService,
    OutboxDispatcher,

    // Default to no-op transport for development
    {
      provide: 'EventTransport',
      useClass: NoopEventTransport,
    },
  ],
  exports: [
    EventBus, // Legacy
    DurableEventPublisherService, // New durable publisher
    OutboxRepository, // For direct repository access if needed
  ],
})
export class EventingModule {}
