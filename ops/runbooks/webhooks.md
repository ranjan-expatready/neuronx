# Webhooks Runbook

## Overview

The webhook system delivers events to customer-configured endpoints via HTTP POST requests with HMAC signatures.

## Alerts

### WebhookDeadLettersGrowing

**Threshold:** `increase(neuronx_webhook_dead_letter_total[15m]) > 0` for 15 minutes

#### What this means

Webhook deliveries are failing after all retry attempts and being moved to dead letter queue.

#### Likely causes

1. **Endpoint failures:** Customer webhook endpoints consistently returning 5xx errors
2. **Authentication issues:** Invalid HMAC signatures or endpoint authentication
3. **Network issues:** Persistent connectivity problems to customer endpoints
4. **Rate limiting:** Customer endpoints rate-limiting our requests
5. **Endpoint changes:** Customer moved/changed endpoints without updating configuration

#### Immediate checks

```promql
# Check delivery failure rate
rate(neuronx_webhook_delivery_fail_total[5m])

# Check dead letter growth
increase(neuronx_webhook_dead_letter_total[15m])
```

```sql
-- Check dead letter webhook deliveries
SELECT endpoint_id, COUNT(*) as failed_count
FROM webhook_deliveries
WHERE status = 'DEAD_LETTER'
  AND updated_at > NOW() - INTERVAL '1 hour'
GROUP BY endpoint_id
ORDER BY failed_count DESC
LIMIT 10;
```

#### First remediation steps

1. **Check endpoint configurations:** Verify webhook URLs are still valid
2. **Test endpoint connectivity:** Manually test customer endpoints
3. **Review authentication:** Ensure secrets are properly configured
4. **Check customer notifications:** Notify customers of endpoint issues
5. **Implement circuit breaker:** Temporarily disable problematic endpoints

#### Escalation path

- **After 15 minutes:** Notify customer success team
- **After 1 hour:** Page on-call engineer
- **After 2 hours:** Escalate to engineering leadership

---

### WebhookFailureRateHigh

**Threshold:** `rate(neuronx_webhook_delivery_fail_total[5m]) / rate(neuronx_webhook_delivery_total[5m]) > 0.2` for 10 minutes

#### What this means

More than 20% of webhook deliveries are failing.

#### Likely causes

1. **Widespread endpoint issues:** Multiple customers experiencing problems
2. **Network issues:** General connectivity problems
3. **Rate limiting:** Customers implementing aggressive rate limits
4. **Authentication problems:** Widespread secret rotation issues
5. **Platform issues:** Problems with our webhook delivery infrastructure

#### Immediate checks

```promql
# Check overall delivery rates
rate(neuronx_webhook_delivery_total[5m])

# Check latency percentiles
histogram_quantile(0.95, rate(neuronx_webhook_delivery_duration_ms_bucket[5m]))
```

```sql
-- Check failure patterns by endpoint
SELECT
  wd.endpoint_id,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN wa.status = 'FAILED' THEN 1 ELSE 0 END) as failed_attempts,
  ROUND(
    SUM(CASE WHEN wa.status = 'FAILED' THEN 1 ELSE 0 END)::decimal /
    COUNT(*)::decimal * 100, 2
  ) as failure_rate
FROM webhook_deliveries wd
JOIN webhook_attempts wa ON wd.id = wa.delivery_id
WHERE wd.created_at > NOW() - INTERVAL '10 minutes'
GROUP BY wd.endpoint_id
HAVING COUNT(*) > 5
ORDER BY failure_rate DESC;
```

#### First remediation steps

1. **Check infrastructure health:** Verify webhook workers are running
2. **Monitor network connectivity:** Check for general network issues
3. **Review rate limiting:** Implement backoff strategies
4. **Check authentication:** Verify secret management is working
5. **Implement graceful degradation:** Queue failed deliveries for retry

#### Escalation path

- **After 10 minutes:** Notify platform team
- **After 30 minutes:** Page on-call engineer
- **After 1 hour:** Escalate to engineering leadership

---

### WebhookLatencyP95High

**Threshold:** `histogram_quantile(0.95, rate(neuronx_webhook_delivery_duration_ms_bucket[5m])) > 2000` for 10 minutes

#### What this means

95th percentile webhook delivery latency exceeds 2 seconds.

#### Likely causes

1. **Slow customer endpoints:** Customer systems responding slowly
2. **Network latency:** Increased network round-trip times
3. **Rate limiting delays:** Customer systems implementing delays
4. **Large payloads:** Events becoming too large for efficient delivery
5. **Resource constraints:** Insufficient webhook worker capacity

#### Immediate checks

```promql
# Check latency distribution
histogram_quantile(0.5, rate(neuronx_webhook_delivery_duration_ms_bucket[5m]))
histogram_quantile(0.95, rate(neuronx_webhook_delivery_duration_ms_bucket[5m]))
histogram_quantile(0.99, rate(neuronx_webhook_delivery_duration_ms_bucket[5m]))

# Check throughput
rate(neuronx_webhook_delivery_total[5m])
```

```sql
-- Check slow deliveries
SELECT
  endpoint_id,
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration,
  COUNT(*) as delivery_count
FROM webhook_deliveries
WHERE created_at > NOW() - INTERVAL '10 minutes'
  AND duration_ms > 2000
GROUP BY endpoint_id
ORDER BY avg_duration DESC;
```

#### First remediation steps

1. **Check customer endpoint performance:** Test response times manually
2. **Implement timeouts:** Increase timeout values for slow endpoints
3. **Optimize payloads:** Review event payload sizes
4. **Scale workers:** Add more webhook delivery workers
5. **Implement async delivery:** Queue deliveries during high latency periods

#### Escalation path

- **After 10 minutes:** Monitor for customer impact
- **After 30 minutes:** Notify platform team if widespread
- **After 1 hour:** Page on-call engineer if affecting core functionality
