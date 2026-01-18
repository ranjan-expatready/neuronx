import { NeuronxEvent } from '@neuronx/contracts';

export interface EventPublisher {
  publish(event: NeuronxEvent): Promise<void>;
  publishBatch(events: NeuronxEvent[]): Promise<void>;
}

export interface EventSubscriber {
  subscribe(eventTypes: string[], handler: EventHandler): Promise<void>;
  unsubscribe(eventTypes: string[], handler: EventHandler): Promise<void>;
}

export interface EventHandler {
  handle(event: NeuronxEvent): Promise<void>;
}

export interface EventBus extends EventPublisher, EventSubscriber {
  // Combined interface for event publishing and subscription
}

export interface OutboxProcessor {
  processPendingEvents(): Promise<void>;
  markEventPublished(eventId: string): Promise<void>;
  getFailedEvents(): Promise<NeuronxEvent[]>;
}
