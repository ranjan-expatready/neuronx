import type { NeuronxEvent } from '@neuronx/contracts';
import { EventBus, EventHandler } from './interfaces';

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, EventHandler[]>();

  async publish(event: NeuronxEvent): Promise<void> {
    const eventHandlers = this.handlers.get(event.type) || [];
    const wildcardHandlers = this.handlers.get('*') || [];

    const allHandlers = [...eventHandlers, ...wildcardHandlers];

    // Process all handlers asynchronously
    await Promise.all(
      allHandlers.map(handler => this.safeHandle(handler, event))
    );
  }

  async publishBatch(events: NeuronxEvent[]): Promise<void> {
    await Promise.all(events.map(event => this.publish(event)));
  }

  async subscribe(eventTypes: string[], handler: EventHandler): Promise<void> {
    for (const eventType of eventTypes) {
      if (!this.handlers.has(eventType)) {
        this.handlers.set(eventType, []);
      }
      this.handlers.get(eventType)!.push(handler);
    }
  }

  async unsubscribe(
    eventTypes: string[],
    handler: EventHandler
  ): Promise<void> {
    for (const eventType of eventTypes) {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }

  private async safeHandle(
    handler: EventHandler,
    event: NeuronxEvent
  ): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      console.error(`Event handler failed for event ${event.type}:`, error);
      // In a production implementation, you would:
      // - Log the error with proper observability
      // - Potentially retry or dead-letter the event
      // - Alert on persistent failures
    }
  }
}
