# Limits, Retries, and Errors

**Last verified:** 2026-01-03
**Sources:** [GHL API Limits](https://developers.gohighlevel.com/reference/api-rate-limits), [Error Handling](https://developers.gohighlevel.com/reference/errors)

## Rate Limiting

GoHighLevel enforces rate limits to ensure API stability and fair usage across all integrations.

### Rate Limit Categories

| Category             | Limit    | Reset Period | Scope        | Notes                        |
| -------------------- | -------- | ------------ | ------------ | ---------------------------- |
| **Read Operations**  | 100/min  | 60 seconds   | Per API key  | Safe for sync operations     |
| **Write Operations** | 50/min   | 60 seconds   | Per API key  | Queue bulk operations        |
| **Bulk Operations**  | 10/min   | 60 seconds   | Per API key  | Reserve for maintenance      |
| **Auth Operations**  | 30/min   | 60 seconds   | Per client   | Token refresh and validation |
| **Webhook Delivery** | 1000/min | 60 seconds   | Per endpoint | Handle spikes gracefully     |

### Rate Limit Headers

GHL includes rate limit information in response headers:

```javascript
// Response headers from any API call
{
  'X-RateLimit-Limit': '100',        // Requests allowed per window
  'X-RateLimit-Remaining': '87',     // Requests remaining in window
  'X-RateLimit-Reset': '1640995200', // Unix timestamp when limit resets
  'X-RateLimit-Retry-After': '30'    // Seconds to wait if exceeded
}
```

### Rate Limit Detection and Handling

```javascript
class RateLimitHandler {
  async executeWithRateLimit(apiCall, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await apiCall();

        // Check rate limit headers
        const remaining = parseInt(
          response.headers.get('x-ratelimit-remaining')
        );
        const resetTime = parseInt(response.headers.get('x-ratelimit-reset'));

        if (remaining < 10) {
          // Buffer for safety
          const waitTime = Math.max(0, resetTime * 1000 - Date.now());
          console.warn(`Rate limit approaching, waiting ${waitTime}ms`);
          await this.sleep(waitTime);
        }

        return response;
      } catch (error) {
        if (error.status === 429) {
          const retryAfter = error.headers?.get('retry-after') || baseDelay;
          const waitTime = parseInt(retryAfter) * 1000;

          console.warn(
            `Rate limited, waiting ${waitTime}ms (attempt ${attempt}/${maxRetries})`
          );

          if (attempt < maxRetries) {
            await this.sleep(waitTime);
            continue;
          }
        }

        throw error;
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Retry Strategy

### Exponential Backoff Algorithm

```javascript
class RetryHandler {
  async executeWithRetry(operation, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 1000; // 1 second
    const maxDelay = options.maxDelay || 30000; // 30 seconds

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry certain errors
        if (!this.shouldRetry(error)) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.min(
            baseDelay * Math.pow(2, attempt - 1),
            maxDelay
          );

          console.warn(
            `Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`,
            error.message
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  shouldRetry(error) {
    // Retry on network errors, 5xx server errors, and rate limits
    const retryableStatuses = [429, 500, 502, 503, 504];

    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true; // Network errors
    }

    if (error.status && retryableStatuses.includes(error.status)) {
      return true; // HTTP errors
    }

    return false; // Don't retry 4xx client errors
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Idempotency for Safe Retries

```javascript
class IdempotentOperation {
  constructor(operationId, operation) {
    this.operationId = operationId;
    this.operation = operation;
    this.completed = false;
    this.result = null;
    this.error = null;
  }

  async execute() {
    if (this.completed) {
      return this.result;
    }

    try {
      this.result = await this.operation();
      this.completed = true;
      return this.result;
    } catch (error) {
      this.error = error;
      throw error;
    }
  }

  // For persistence across restarts
  toJSON() {
    return {
      operationId: this.operationId,
      completed: this.completed,
      result: this.result,
      error: this.error
        ? {
            message: this.error.message,
            status: this.error.status,
          }
        : null,
    };
  }
}
```

## Error Categories and Handling

### Authentication Errors (400-403)

| Error Code             | Description                  | Handling Strategy                                  |
| ---------------------- | ---------------------------- | -------------------------------------------------- |
| `400 Bad Request`      | Invalid request parameters   | Validate input data, check required fields         |
| `401 Unauthorized`     | Invalid or expired token     | Trigger token refresh or re-authentication         |
| `403 Forbidden`        | Insufficient permissions     | Check OAuth scopes, request additional permissions |
| `403 Invalid Location` | Token doesn't match location | Verify location context, use correct token         |

**Example Error Response:**

```json
{
  "error": "insufficient_scope",
  "message": "Missing required scope: contacts.write",
  "code": "FORBIDDEN"
}
```

### Rate Limiting Errors (429)

| Scenario            | Response                | Handling                               |
| ------------------- | ----------------------- | -------------------------------------- |
| Rate limit exceeded | `429 Too Many Requests` | Wait for reset time, implement queuing |
| Burst limit hit     | `429 Too Many Requests` | Implement token bucket algorithm       |
| Daily limit reached | `429 Too Many Requests` | Queue for next day, notify user        |

**Rate Limit Error Response:**

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests",
  "retry_after": 60,
  "limit": 100,
  "remaining": 0,
  "reset": 1640995200
}
```

### Server Errors (500-504)

| Error Code                  | Description         | Handling Strategy                       |
| --------------------------- | ------------------- | --------------------------------------- |
| `500 Internal Server Error` | GHL server error    | Retry with exponential backoff          |
| `502 Bad Gateway`           | Gateway timeout     | Retry, may indicate temporary overload  |
| `503 Service Unavailable`   | Service maintenance | Longer retry delay, exponential backoff |
| `504 Gateway Timeout`       | Request timeout     | Retry, consider request optimization    |

### Resource Errors (404, 409, 422)

| Error Code                 | Description             | Handling Strategy                                 |
| -------------------------- | ----------------------- | ------------------------------------------------- |
| `404 Not Found`            | Resource doesn't exist  | Check resource ID, handle gracefully              |
| `409 Conflict`             | Resource state conflict | Check current state, implement optimistic locking |
| `422 Unprocessable Entity` | Validation error        | Fix data, don't retry automatically               |

## Debug Hell Kill Switch

### Correlation ID Strategy

Every API call and webhook must include correlation IDs for end-to-end tracing:

```javascript
class CorrelationContext {
  constructor(requestId = null) {
    this.requestId = requestId || this.generateId();
    this.startTime = Date.now();
    this.steps = [];
  }

  generateId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addStep(step, data = {}) {
    this.steps.push({
      timestamp: Date.now(),
      step,
      data,
    });
  }

  logError(error, context = {}) {
    console.error(`[${this.requestId}] Error in ${this.getCurrentStep()}:`, {
      error: error.message,
      stack: error.stack,
      context,
      duration: Date.now() - this.startTime,
      steps: this.steps,
    });
  }

  getCurrentStep() {
    return this.steps[this.steps.length - 1]?.step || 'unknown';
  }

  toJSON() {
    return {
      requestId: this.requestId,
      duration: Date.now() - this.startTime,
      steps: this.steps,
      completed: this.steps.length > 0,
    };
  }
}

// Usage in API calls
async function apiCallWithCorrelation(endpoint, options) {
  const correlation = new CorrelationContext(options.correlationId);
  correlation.addStep('api_call_start', { endpoint, method: options.method });

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'X-Correlation-ID': correlation.requestId,
      },
    });

    correlation.addStep('api_call_complete', { status: response.status });
    return response;
  } catch (error) {
    correlation.logError(error, { endpoint });
    throw error;
  }
}
```

### Structured Logging

```javascript
class StructuredLogger {
  log(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: context.correlationId,
      tenantId: context.tenantId,
      locationId: context.locationId,
      operation: context.operation,
      duration: context.duration,
      error: context.error
        ? {
            message: context.error.message,
            status: context.error.status,
            code: context.error.code,
          }
        : undefined,
      metadata: context.metadata,
    };

    console.log(JSON.stringify(logEntry));
  }

  info(message, context) {
    this.log('info', message, context);
  }
  warn(message, context) {
    this.log('warn', message, context);
  }
  error(message, context) {
    this.log('error', message, context);
  }
  debug(message, context) {
    this.log('debug', message, context);
  }
}
```

### Debug Endpoints

```javascript
// Debug endpoint for troubleshooting
app.get('/debug/request/:correlationId', async (req, res) => {
  const { correlationId } = req.params;

  // Query logs for this correlation ID
  const logs = await logStorage.queryByCorrelationId(correlationId);

  // Get request context
  const context = await contextStorage.get(correlationId);

  res.json({
    correlationId,
    logs,
    context,
    timeline: this.buildTimeline(logs)
  });
});

buildTimeline(logs) {
  return logs
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(log => ({
      time: log.timestamp,
      step: log.operation,
      status: log.level === 'error' ? 'failed' : 'success',
      message: log.message,
      duration: log.duration
    }));
}
```

## Monitoring and Alerting

### Key Metrics to Monitor

```javascript
class GhlMetricsCollector {
  constructor() {
    this.metrics = {
      apiCallsTotal: 0,
      apiCallsByEndpoint: new Map(),
      errorsByType: new Map(),
      rateLimitHits: 0,
      tokenRefreshCount: 0,
      averageResponseTime: 0,
    };
  }

  recordApiCall(endpoint, duration, status) {
    this.metrics.apiCallsTotal++;
    this.metrics.apiCallsByEndpoint.set(
      endpoint,
      (this.metrics.apiCallsByEndpoint.get(endpoint) || 0) + 1
    );

    // Update average response time
    const currentAvg = this.metrics.averageResponseTime;
    const totalCalls = this.metrics.apiCallsTotal;
    this.metrics.averageResponseTime =
      (currentAvg * (totalCalls - 1) + duration) / totalCalls;

    // Alert on high error rates
    if (status >= 400) {
      this.recordError(status);
    }
  }

  recordError(status) {
    const errorType = this.categorizeError(status);
    this.metrics.errorsByType.set(
      errorType,
      (this.metrics.errorsByType.get(errorType) || 0) + 1
    );

    // Alert thresholds
    if (this.getErrorRate() > 0.05) {
      // 5% error rate
      this.alert('High error rate detected', {
        errorRate: this.getErrorRate(),
      });
    }
  }

  getErrorRate() {
    const totalErrors = Array.from(this.metrics.errorsByType.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    return totalErrors / this.metrics.apiCallsTotal;
  }
}
```

This comprehensive error handling and monitoring system ensures NeuronX can reliably integrate with GHL while providing excellent debugging capabilities and operational visibility.
