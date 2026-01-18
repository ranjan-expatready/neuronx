// Tracing Interface - Distributed tracing support

export interface TraceSpan {
  id: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, string | number | boolean>;
  events: TraceEvent[];
  status?: 'ok' | 'error';
  error?: string;
}

export interface TraceEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface Tracer {
  startSpan(name: string, parentContext?: TraceContext): TraceSpan;
  endSpan(span: TraceSpan): void;
  addEvent(span: TraceSpan, event: TraceEvent): void;
  setAttribute(
    span: TraceSpan,
    key: string,
    value: string | number | boolean
  ): void;
  setError(span: TraceSpan, error: Error): void;

  // Context management
  getCurrentContext(): TraceContext | null;
  setCurrentContext(context: TraceContext): void;
  createChildContext(parentContext?: TraceContext): TraceContext;

  // Flush traces to external system
  flush(): Promise<void>;
}

// No-op implementation for development
export class NoOpTracer implements Tracer {
  startSpan(name: string, parentContext?: TraceContext): TraceSpan {
    return {
      id: `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      startTime: Date.now(),
      attributes: {},
      events: [],
    };
  }

  endSpan(span: TraceSpan): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
  }

  addEvent(span: TraceSpan, event: TraceEvent): void {
    span.events.push(event);
  }

  setAttribute(
    span: TraceSpan,
    key: string,
    value: string | number | boolean
  ): void {
    span.attributes[key] = value;
  }

  setError(span: TraceSpan, error: Error): void {
    span.status = 'error';
    span.error = error.message;
  }

  getCurrentContext(): TraceContext | null {
    return null;
  }

  setCurrentContext(context: TraceContext): void {
    // No-op
  }

  createChildContext(parentContext?: TraceContext): TraceContext {
    return {
      traceId:
        parentContext?.traceId ||
        `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      spanId: `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parentSpanId: parentContext?.spanId,
    };
  }

  async flush(): Promise<void> {
    // No-op
  }
}

// In-memory tracer for development/testing
export class InMemoryTracer implements Tracer {
  private spans: TraceSpan[] = [];
  private currentContext: TraceContext | null = null;

  startSpan(name: string, parentContext?: TraceContext): TraceSpan {
    const context =
      parentContext || this.getCurrentContext() || this.createChildContext();
    const span: TraceSpan = {
      id: context.spanId,
      parentId: context.parentSpanId,
      name,
      startTime: Date.now(),
      attributes: {},
      events: [],
    };

    this.spans.push(span);
    return span;
  }

  endSpan(span: TraceSpan): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
  }

  addEvent(span: TraceSpan, event: TraceEvent): void {
    span.events.push(event);
  }

  setAttribute(
    span: TraceSpan,
    key: string,
    value: string | number | boolean
  ): void {
    span.attributes[key] = value;
  }

  setError(span: TraceSpan, error: Error): void {
    span.status = 'error';
    span.error = error.message;
  }

  getCurrentContext(): TraceContext | null {
    return this.currentContext;
  }

  setCurrentContext(context: TraceContext): void {
    this.currentContext = context;
  }

  createChildContext(parentContext?: TraceContext): TraceContext {
    const parent = parentContext || this.currentContext;

    return {
      traceId:
        parent?.traceId ||
        `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      spanId: `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parentSpanId: parent?.spanId,
    };
  }

  async flush(): Promise<void> {
    // Log spans for development
    console.log('Trace flush:', this.spans.slice(-10)); // Last 10 spans
  }

  // Development helpers
  getSpans(): TraceSpan[] {
    return [...this.spans];
  }

  reset(): void {
    this.spans = [];
    this.currentContext = null;
  }

  getStats(): {
    totalSpans: number;
    activeSpans: number;
    completedSpans: number;
    errorSpans: number;
  } {
    const activeSpans = this.spans.filter(s => !s.endTime).length;
    const completedSpans = this.spans.filter(
      s => s.endTime && s.status !== 'error'
    ).length;
    const errorSpans = this.spans.filter(s => s.status === 'error').length;

    return {
      totalSpans: this.spans.length,
      activeSpans,
      completedSpans,
      errorSpans,
    };
  }
}

// Global tracer instance
let globalTracer: Tracer = new NoOpTracer();

// Tracer factory
export function createTracer(): Tracer {
  return globalTracer;
}

export function setGlobalTracer(tracer: Tracer): void {
  globalTracer = tracer;
}

// Convenience functions and decorators
export const tracing = {
  startSpan: (name: string, parentContext?: TraceContext) =>
    globalTracer.startSpan(name, parentContext),
  endSpan: (span: TraceSpan) => globalTracer.endSpan(span),
  addEvent: (span: TraceSpan, event: TraceEvent) =>
    globalTracer.addEvent(span, event),
  setAttribute: (
    span: TraceSpan,
    key: string,
    value: string | number | boolean
  ) => globalTracer.setAttribute(span, key, value),
  setError: (span: TraceSpan, error: Error) =>
    globalTracer.setError(span, error),

  // Higher-level helpers
  traceAsync: async <T>(
    name: string,
    operation: (span: TraceSpan) => Promise<T>,
    parentContext?: TraceContext
  ): Promise<T> => {
    const span = globalTracer.startSpan(name, parentContext);

    try {
      const result = await operation(span);
      globalTracer.endSpan(span);
      return result;
    } catch (error) {
      globalTracer.setError(span, error);
      globalTracer.endSpan(span);
      throw error;
    }
  },

  traceSync: <T>(
    name: string,
    operation: (span: TraceSpan) => T,
    parentContext?: TraceContext
  ): T => {
    const span = globalTracer.startSpan(name, parentContext);

    try {
      const result = operation(span);
      globalTracer.endSpan(span);
      return result;
    } catch (error) {
      globalTracer.setError(span, error);
      globalTracer.endSpan(span);
      throw error;
    }
  },
};
