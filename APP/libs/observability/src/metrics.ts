// Metrics Interface - Structured telemetry collection

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricValue {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

export interface Counter extends MetricValue {
  type: 'counter';
  increment?: number;
}

export interface Gauge extends MetricValue {
  type: 'gauge';
}

export interface Histogram extends MetricValue {
  type: 'histogram';
  buckets?: number[];
}

export interface Summary extends MetricValue {
  type: 'summary';
  quantiles?: number[];
}

export interface MetricsCollector {
  incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value?: number
  ): void;
  setGauge(name: string, value: number, labels?: Record<string, string>): void;
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void;
  recordSummary(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void;

  // Batch operations
  recordMetrics(metrics: (Counter | Gauge | Histogram | Summary)[]): void;

  // Query operations (for monitoring)
  getCounterValue(name: string, labels?: Record<string, string>): number;
  getGaugeValue(name: string, labels?: Record<string, string>): number;

  // Flush metrics to external system
  flush(): Promise<void>;
}

// No-op implementation for development
export class NoOpMetricsCollector implements MetricsCollector {
  incrementCounter(
    _name: string,
    _labels?: Record<string, string>,
    _value?: number
  ): void {
    // No-op
  }

  setGauge(_name: string, _value: number, _labels?: Record<string, string>): void {
    // No-op
  }

  recordHistogram(
    _name: string,
    _value: number,
    _labels?: Record<string, string>
  ): void {
    // No-op
  }

  recordSummary(
    _name: string,
    _value: number,
    _labels?: Record<string, string>
  ): void {
    // No-op
  }

  recordMetrics(_metrics: (Counter | Gauge | Histogram | Summary)[]): void {
    // No-op
  }

  getCounterValue(_name: string, _labels?: Record<string, string>): number {
    return 0;
  }

  getGaugeValue(_name: string, _labels?: Record<string, string>): number {
    return 0;
  }

  async flush(): Promise<void> {
    // No-op
  }
}

// In-memory metrics for development/testing
export class InMemoryMetricsCollector implements MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms: {
    name: string;
    values: number[];
    labels?: Record<string, string>;
  }[] = [];

  private getKey(name: string, labels?: Record<string, string>): string {
    const labelStr = labels ? JSON.stringify(labels) : '';
    return `${name}:${labelStr}`;
  }

  incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value: number = 1
  ): void {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
  }

  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.histograms.push({ name, values: [value], labels });
  }

  recordSummary(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    // For simplicity, treat summary like histogram in memory
    this.recordHistogram(name, value, labels);
  }

  recordMetrics(metrics: (Counter | Gauge | Histogram | Summary)[]): void {
    for (const metric of metrics) {
      switch (metric.type) {
        case 'counter':
          this.incrementCounter(metric.name, metric.labels, metric.value);
          break;
        case 'gauge':
          this.setGauge(metric.name, metric.value, metric.labels);
          break;
        case 'histogram':
        case 'summary':
          this.recordHistogram(metric.name, metric.value, metric.labels);
          break;
      }
    }
  }

  getCounterValue(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.counters.get(key) || 0;
  }

  getGaugeValue(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  async flush(): Promise<void> {
    // In memory, just log for development
    console.log('Metrics flush:', {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histogramCount: this.histograms.length,
    });
  }

  // Development helpers
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms = [];
  }

  getStats(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histogramCount: number;
  } {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histogramCount: this.histograms.length,
    };
  }
}

// Global metrics instance
let globalMetrics: MetricsCollector = new NoOpMetricsCollector();

// Metrics factory
export function createMetricsCollector(): MetricsCollector {
  return globalMetrics;
}

export function setGlobalMetricsCollector(collector: MetricsCollector): void {
  globalMetrics = collector;
}

// Convenience functions
export const metrics = {
  increment: (name: string, labels?: Record<string, string>, value?: number) =>
    globalMetrics.incrementCounter(name, labels, value),

  gauge: (name: string, value: number, labels?: Record<string, string>) =>
    globalMetrics.setGauge(name, value, labels),

  histogram: (name: string, value: number, labels?: Record<string, string>) =>
    globalMetrics.recordHistogram(name, value, labels),

  timing: (name: string, startTime: number, labels?: Record<string, string>) =>
    globalMetrics.recordHistogram(name, Date.now() - startTime, {
      ...labels,
      unit: 'ms',
    }),

  flush: () => globalMetrics.flush(),
};
