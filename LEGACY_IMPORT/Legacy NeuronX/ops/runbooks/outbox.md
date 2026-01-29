# Outbox Runbook

## Overview

The outbox system handles asynchronous event publishing to external systems. Events are written to the outbox table and processed by background workers.

## Alerts

### OutboxBacklogHigh

**Threshold:** `neuronx_outbox_pending_total > 1000` for 10 minutes

#### What this means

The outbox has accumulated more than 1000 pending events that haven't been processed yet.

#### Likely causes

1. **Worker downtime:** Outbox processing workers are not running or have crashed
2. **Database issues:** Slow queries or connection problems preventing event processing
3. **External system issues:** Target systems (webhooks, integrations) are down or slow
4. **High event volume:** Sudden spike in event generation exceeding processing capacity
5. **Lock contention:** Multiple workers competing for advisory locks

#### Immediate checks

```promql
# Check worker status
up{job="neuronx"}  # Should be 1

# Check database connections
rate(prometheus_tsdb_head_samples_appended_total[5m])

# Check outbox processing rate
rate(neuronx_outbox_publish_success_total[5m])
```

```sql
-- Check pending vs processing events
SELECT status, COUNT(*) FROM outbox_events GROUP BY status;

-- Check for stuck processing events (older than 5 minutes)
SELECT COUNT(*) FROM outbox_events
WHERE status = 'PROCESSING' AND created_at < NOW() - INTERVAL '5 minutes';
```

#### First remediation steps

1. **Check worker logs:** Look for errors in outbox processing logs
2. **Verify database connectivity:** Ensure DB connections are healthy
3. **Restart workers:** If workers are down, restart the outbox processing service
4. **Check external systems:** Verify target systems are accepting events
5. **Scale workers:** If volume is high, consider scaling worker instances

#### Escalation path

- **After 30 minutes:** Page on-call engineer
- **After 1 hour:** Escalate to platform team
- **After 2 hours:** Escalate to engineering leadership

---

### OutboxDeadLettersGrowing

**Threshold:** `increase(neuronx_outbox_dead_letter_total[15m]) > 0` for 15 minutes

#### What this means

Events are failing repeatedly and being moved to the dead letter queue.

#### Likely causes

1. **External system failures:** Target systems consistently rejecting events
2. **Event corruption:** Malformed events that cannot be processed
3. **Authentication issues:** Invalid credentials for external systems
4. **Rate limiting:** External systems rate-limiting our requests
5. **Network issues:** Persistent connectivity problems

#### Immediate checks

```promql
# Check failure rate
rate(neuronx_outbox_publish_fail_total[5m])

# Check dead letter growth
increase(neuronx_outbox_dead_letter_total[15m])
```

```sql
-- Check recent dead letter events
SELECT event_type, error_message, COUNT(*)
FROM outbox_events
WHERE status = 'DEAD_LETTER' AND updated_at > NOW() - INTERVAL '1 hour'
GROUP BY event_type, error_message
ORDER BY COUNT(*) DESC;
```

#### First remediation steps

1. **Review dead letter events:** Examine error messages in dead letter events
2. **Check external system status:** Verify target systems are operational
3. **Validate credentials:** Ensure API keys/tokens are valid
4. **Check network connectivity:** Verify outbound connectivity
5. **Review event format:** Ensure events conform to expected schema

#### Escalation path

- **After 15 minutes:** Notify integration owners
- **After 1 hour:** Page on-call engineer
- **After 2 hours:** Escalate to platform team

---

### OutboxPublishFailureRateHigh

**Threshold:** `rate(neuronx_outbox_publish_fail_total[5m]) / rate(neuronx_outbox_publish_total[5m]) > 0.1` for 10 minutes

#### What this means

More than 10% of outbox events are failing to publish.

#### Likely causes

1. **External API issues:** Target systems returning errors
2. **Network timeouts:** Connectivity issues causing timeouts
3. **Rate limiting:** Being throttled by external systems
4. **Authentication failures:** Invalid or expired credentials
5. **Schema changes:** Events no longer compatible with target systems

#### Immediate checks

```promql
# Check detailed failure rates
rate(neuronx_outbox_publish_fail_total[5m])

# Check latency percentiles
histogram_quantile(0.95, rate(neuronx_outbox_dispatch_duration_ms_bucket[5m]))
```

```sql
-- Check failure patterns
SELECT
  CASE
    WHEN error_message LIKE '%timeout%' THEN 'timeout'
    WHEN error_message LIKE '%auth%' THEN 'authentication'
    WHEN error_message LIKE '%rate%' THEN 'rate_limit'
    ELSE 'other'
  END as error_category,
  COUNT(*)
FROM outbox_events
WHERE status = 'FAILED' AND updated_at > NOW() - INTERVAL '10 minutes'
GROUP BY error_category;
```

#### First remediation steps

1. **Check external system status pages:** Verify target systems are operational
2. **Review authentication:** Rotate credentials if needed
3. **Check rate limits:** Implement backoff or reduce sending rate
4. **Monitor network:** Check for connectivity issues
5. **Validate event payloads:** Ensure events are properly formatted

#### Escalation path

- **After 10 minutes:** Notify integration owners
- **After 30 minutes:** Page on-call engineer
- **After 1 hour:** Escalate to engineering leadership
