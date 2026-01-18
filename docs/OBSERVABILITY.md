# Observability Guide

**Last verified:** 2026-01-03
**Purpose:** FAANG-grade monitoring, debugging, and alerting for NeuronX

## Overview

NeuronX implements comprehensive observability with structured logging, metrics collection, and distributed tracing to ensure production reliability and rapid incident response.

## Structured Logging

### Log Levels

- **DEBUG**: Detailed diagnostic information
- **INFO**: General operational messages
- **WARN**: Warning conditions that don't prevent operation
- **ERROR**: Error conditions requiring attention

### Required Context Fields

All logs must include relevant context for correlation and debugging:

```typescript
{
  correlationId: "corr_1234567890",    // Request correlation
  tenantId: "tenant_abc",              // Multi-tenant isolation
  userId: "user_123",                  // User identification
  requestId: "req_0987654321",         // HTTP request ID
  operation: "ghl.createContact",      // Operation being performed
  component: "GhlAdapter",             // Component name
  duration: 125,                       // Operation duration in ms
}
```

### Key Log Patterns

#### API Operations

```
[INFO] GHL API call completed - provider=ghl tenant_id=abc correlation_id=xyz duration_ms=125 status=200
[ERROR] GHL API call failed - provider=ghl tenant_id=abc correlation_id=xyz error="Rate limit exceeded" retry_after=60
```

#### Authentication

```
[INFO] OAuth token refreshed - tenant_id=abc provider=ghl expires_in=3600
[WARN] OAuth token refresh failed - tenant_id=abc provider=ghl error="Invalid refresh token"
```

#### Webhooks

```
[INFO] Webhook processed - tenant_id=abc webhook_id=web_123 event_type=contact.created correlation_id=xyz processing_time=45
[WARN] Webhook signature invalid - tenant_id=abc webhook_id=web_123 error="HMAC mismatch"
```

#### Business Operations

```
[INFO] Lead scored and qualified - tenant_id=abc lead_id=lead_123 score=85 routing_threshold=75
[ERROR] Lead routing failed - tenant_id=abc lead_id=lead_123 error="GHL API unavailable"
```

## Metrics Collection

### Counter Metrics

- `http_requests_total{provider, status, method}` - Total API requests
- `webhook_processed_total{provider, event_type, status}` - Webhook processing
- `token_refresh_total{provider, status}` - Token refresh operations

### Gauge Metrics

- `active_connections{provider}` - Active external connections
- `rate_limiter_queue_size{provider}` - Queued requests
- `circuit_breaker_state{provider}` - Circuit breaker status (0=closed, 1=open)

### Histogram Metrics

- `http_request_duration_seconds{provider, method}` - API call latency
- `webhook_processing_duration_seconds{provider, event_type}` - Webhook processing time
- `token_refresh_duration_seconds{provider}` - Token refresh time

## Distributed Tracing

### Trace Hierarchy

```
HTTP Request
├── GHL OAuth Validation
├── Token Retrieval
├── API Call
│   ├── HTTP Client Retry
│   └── Response Processing
└── Business Logic Processing
    ├── Lead Scoring
    ├── Routing Decision
    └── Event Publishing
```

### Span Naming Convention

- `http.{method}.{endpoint}` - HTTP API calls
- `webhook.process` - Webhook processing
- `oauth.validate` - OAuth validation
- `token.refresh` - Token refresh operations
- `{domain}.{operation}` - Business operations

### Trace Context Propagation

All operations must propagate trace context:

- `traceId`: Unique trace identifier
- `spanId`: Current span identifier
- `parentSpanId`: Parent span identifier

## Alerting Thresholds

### Critical Alerts

- Circuit breaker open for >5 minutes
- Token refresh failure rate >10%
- Webhook signature validation failure rate >5%
- API error rate >15%

### Warning Alerts

- Increased latency (>500ms p95)
- Queue depth >50 requests
- Token expiry <1 hour for active tenants

## Monitoring Dashboards

### Key Metrics to Monitor

1. **API Health**: Success rates, latency, error patterns
2. **Authentication**: Token refresh success, expiry distribution
3. **Webhooks**: Processing rates, signature validation, replay detection
4. **Business Metrics**: Lead processing rates, scoring accuracy
5. **Infrastructure**: Queue depths, circuit breaker states

### Sample Queries

#### Error Rate by Provider

```
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.1
```

#### Webhook Processing Latency

```
histogram_quantile(0.95, rate(webhook_processing_duration_seconds_bucket[5m]))
```

#### Token Health

```
count(token_refresh_total{status="success"}) / count(token_refresh_total) < 0.95
```

## Debugging Workflows

### Incident Response

1. **Check correlation ID** across all logs
2. **Review trace spans** for operation flow
3. **Examine metrics** for patterns and thresholds
4. **Validate configuration** for environment-specific issues
5. **Check external service status** (GHL, database, etc.)

### Common Issues

- **High latency**: Check rate limiting, circuit breaker state
- **Authentication failures**: Verify token validity, refresh status
- **Webhook processing failures**: Check signature validation, replay detection
- **API errors**: Review error patterns, retry logic effectiveness

## Configuration

### Environment Variables

```bash
LOG_LEVEL=info                    # debug, info, warn, error
SENTRY_DSN=https://...           # Error tracking
OTEL_EXPORTER_OTLP_ENDPOINT=...  # Trace collection
```

### Runtime Configuration

```typescript
import {
  setGlobalLogger,
  setGlobalMetricsCollector,
} from '@neuronx/observability';

// Configure for production
setGlobalLogger(new StructuredLogger(config));
setGlobalMetricsCollector(new PrometheusMetricsCollector());
```

## Implementation Guidelines

### Logging Best Practices

- Always include correlation ID
- Use structured logging over string concatenation
- Avoid logging sensitive data (tokens, secrets)
- Log at appropriate levels (debug for development, info for operations)

### Metrics Collection

- Use consistent naming conventions
- Include relevant labels for filtering
- Collect business metrics alongside technical metrics
- Avoid high-cardinality labels

### Tracing Implementation

- Create spans for all external calls
- Add relevant attributes to spans
- Propagate context across async operations
- Use sampling in high-volume scenarios

This observability framework ensures NeuronX can be reliably monitored, debugged, and maintained at production scale.
