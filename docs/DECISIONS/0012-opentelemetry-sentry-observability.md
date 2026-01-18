# 0012: OpenTelemetry and Sentry Observability

## Status

Accepted

## Context

NeuronX requires comprehensive observability for:

- **Distributed Tracing**: End-to-end request tracking across services and adapters
- **Performance Monitoring**: Latency, throughput, and resource utilization tracking
- **Error Tracking**: Comprehensive error capture with context and debugging information
- **Business Metrics**: Tenant-specific KPIs and usage analytics
- **Compliance Auditing**: Complete audit trails for regulatory requirements
- **Alerting**: Proactive issue detection and incident response
- **Debugging**: Production issue investigation and root cause analysis

Observability choice impacts:

- Incident response time and effectiveness
- System reliability and uptime guarantees
- Development velocity and debugging efficiency
- Compliance and audit capabilities
- Operational cost and complexity
- Future scaling and multi-region support

Poor observability leads to:

- Slow incident response and prolonged outages
- Undetected performance degradation
- Compliance violations and audit failures
- Difficult debugging and development slowdown
- Poor user experience and trust issues
- High operational overhead and costs

## Decision

Adopt OpenTelemetry for distributed tracing and metrics, Sentry for error tracking and monitoring, all abstracted behind clean interfaces.

**OpenTelemetry Components:**

- **Tracing**: End-to-end request tracking across services
- **Metrics**: Performance and business KPIs collection
- **Baggage**: Context propagation between services
- **Sampling**: Intelligent trace sampling for cost control

**Sentry Components:**

- **Error Tracking**: Comprehensive error capture and grouping
- **Performance Monitoring**: Transaction tracing and bottleneck identification
- **Release Tracking**: Deployment monitoring and rollback detection
- **User Feedback**: User-reported issues and context

**Abstraction Layer:**

- **TracingService**: Abstract interface for distributed tracing
- **MetricsService**: Abstract interface for metrics collection
- **ErrorTrackingService**: Abstract interface for error reporting
- **AuditService**: Abstract interface for compliance logging

## Consequences

### Positive

- **Industry Standards**: OpenTelemetry is vendor-neutral and widely adopted
- **Comprehensive Coverage**: Tracing, metrics, and error tracking in one solution
- **Developer Experience**: Rich debugging information and context
- **Enterprise Features**: Advanced sampling, custom instrumentation
- **Cost Effective**: Usage-based pricing scales with adoption
- **Future-Proof**: Open standards prevent vendor lock-in
- **Integration**: Excellent integration with AWS and other services

### Negative

- **Setup Complexity**: Multiple services and configuration layers
- **Performance Impact**: Instrumentation adds latency and overhead
- **Cost Monitoring**: Usage-based pricing requires careful monitoring
- **Learning Curve**: Understanding distributed tracing concepts
- **Data Volume**: High-volume tracing can generate significant data

### Risks

- **Performance Degradation**: Poor instrumentation can slow applications
- **Cost Overruns**: Uncontrolled tracing can increase costs significantly
- **Alert Fatigue**: Over-alerting can desensitize teams
- **Data Privacy**: Trace data may contain sensitive information
- **Complex Debugging**: Distributed traces can be complex to analyze

## Alternatives Considered

### Alternative 1: DataDog APM

- **Pros**: All-in-one solution, excellent dashboards, enterprise features
- **Cons**: Expensive, vendor lock-in, less flexible
- **Rejected**: Cost and flexibility concerns for early-stage startup

### Alternative 2: New Relic

- **Pros**: Comprehensive monitoring, good developer experience
- **Cons**: Expensive, focused on larger enterprises
- **Rejected**: Cost structure not suitable for NeuronX's stage

### Alternative 3: AWS X-Ray + CloudWatch

- **Pros**: Native AWS integration, cost-effective for AWS usage
- **Cons**: Limited advanced features, less mature tracing
- **Rejected**: Less comprehensive than OpenTelemetry + Sentry combination

### Alternative 4: Jaeger + ELK Stack

- **Pros**: Open-source, highly customizable, cost-effective
- **Cons**: High operational complexity, steep learning curve
- **Rejected**: Operational overhead too high for product focus

## Implementation Strategy

### OpenTelemetry Instrumentation

```typescript
// Tracing setup in NestJS
import { Tracer } from '@opentelemetry/api';

@Injectable()
export class TracingService {
  private tracer: Tracer;

  constructor() {
    this.tracer = trace.getTracer('neuronx', '1.0.0');
  }

  startSpan(name: string, attributes?: Record<string, string>) {
    return this.tracer.startSpan(name, {
      attributes: {
        ...attributes,
        tenantId: getCurrentTenantId(),
        service: 'core-api',
      },
    });
  }

  async traceAsync<T>(
    name: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string>
  ): Promise<T> {
    const span = this.startSpan(name, attributes);
    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }
}
```

### Sentry Error Tracking

```typescript
// Error tracking setup
import * as Sentry from '@sentry/node';

@Injectable()
export class ErrorTrackingService {
  captureException(error: Error, context?: Record<string, any>) {
    Sentry.withScope(scope => {
      scope.setTag('tenantId', getCurrentTenantId());
      scope.setTag('service', 'core-api');

      if (context) {
        Object.keys(context).forEach(key => {
          scope.setTag(key, context[key]);
        });
      }

      Sentry.captureException(error);
    });
  }

  captureMessage(
    message: string,
    level: Sentry.SeverityLevel,
    context?: Record<string, any>
  ) {
    Sentry.withScope(scope => {
      scope.setLevel(level);
      scope.setTag('tenantId', getCurrentTenantId());

      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setTag(key, String(value));
        });
      }

      Sentry.captureMessage(message);
    });
  }
}
```

### Metrics Collection

```typescript
// Metrics interface
interface MetricsService {
  incrementCounter(
    name: string,
    value?: number,
    tags?: Record<string, string>
  ): void;
  recordHistogram(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void;
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;
}

// OpenTelemetry metrics implementation
@Injectable()
export class OpenTelemetryMetricsService implements MetricsService {
  private meter: Meter;

  constructor() {
    this.meter = metrics.getMeter('neuronx', '1.0.0');
  }

  incrementCounter(name: string, value = 1, tags?: Record<string, string>) {
    const counter = this.meter.createCounter(name, {
      description: `${name} counter`,
    });

    counter.add(value, {
      ...tags,
      tenantId: getCurrentTenantId(),
      service: 'core-api',
    });
  }

  recordHistogram(name: string, value: number, tags?: Record<string, string>) {
    const histogram = this.meter.createHistogram(name, {
      description: `${name} histogram`,
    });

    histogram.record(value, {
      ...tags,
      tenantId: getCurrentTenantId(),
      service: 'core-api',
    });
  }
}
```

### Distributed Tracing Setup

- **Service Identification**: Unique service names and versions
- **Context Propagation**: W3C Trace Context headers
- **Sampling Strategy**: Intelligent sampling based on service and tenant
- **Resource Attributes**: Service metadata and environment information

### Alerting and Monitoring

- **Error Rate Alerts**: Automatic alerts on error rate thresholds
- **Performance Alerts**: Latency and throughput degradation alerts
- **Business Metric Alerts**: Tenant-specific KPI monitoring
- **Synthetic Monitoring**: Automated health checks and end-to-end tests

### Data Privacy and Compliance

- **PII Filtering**: Automatic filtering of sensitive data in traces
- **Retention Policies**: Configurable data retention per compliance requirements
- **Audit Logging**: All observability data changes are auditable
- **Data Residency**: Regional data storage for compliance

## Related ADRs

- 0008: NestJS Backend Framework
- 0011: AWS SQS/SNS Event and Queue System
- 0013: Clerk Authentication and RBAC

## Notes

OpenTelemetry and Sentry provide the comprehensive observability foundation required for NeuronX's event-driven, multi-tenant architecture. The abstraction layer ensures clean interfaces while leveraging industry-standard tools.

Key success factors:

- Proper instrumentation without performance degradation
- Cost monitoring and optimization of observability data
- Comprehensive alerting for proactive issue detection
- Data privacy and compliance in all observability data
- Clear separation between development and production monitoring
- Regular review of observability effectiveness and coverage

The observability choice enables NeuronX to maintain high reliability, fast incident response, and excellent user experience while meeting enterprise compliance requirements.
