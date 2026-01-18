# Voice Runbook

## Overview

The voice system handles AI-powered phone conversations and call automation.

## Alerts

### VoiceRetryableGrowing

**Threshold:** `neuronx_voice_failed_retryable_total > 25` for 10 minutes

#### What this means

Voice calls are failing but are marked as retryable, accumulating in the system.

#### Likely causes

1. **Provider issues:** Voice provider API problems or outages
2. **Network issues:** Connectivity problems with voice providers
3. **Rate limiting:** Voice provider throttling requests
4. **Authentication:** Invalid provider credentials
5. **Resource constraints:** Insufficient voice processing capacity

#### Immediate checks

```promql
rate(neuronx_voice_retry_attempt_total[5m])
```

```sql
SELECT provider, status, COUNT(*) FROM voice_attempts
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY provider, status;
```

#### First remediation steps

1. Check voice provider status pages
2. Verify provider credentials and API keys
3. Monitor network connectivity to providers
4. Scale voice processing workers if needed

#### Escalation path

- After 10 minutes: Notify voice provider support
- After 30 minutes: Page on-call engineer

---

### VoiceRetryStorm

**Threshold:** `increase(neuronx_voice_retry_attempt_total[10m]) > 100` for 10 minutes

#### What this means

Excessive voice retry attempts indicating a retry storm.

#### Likely causes

1. **Provider outage:** Voice provider completely down
2. **Authentication failure:** Widespread credential issues
3. **Rate limit exceeded:** Aggressive rate limiting by provider
4. **Bug in retry logic:** Retry logic not respecting backoff

#### Immediate checks

```sql
SELECT provider, COUNT(*) as retry_count
FROM voice_attempts
WHERE created_at > NOW() - INTERVAL '10 minutes'
  AND attempts > 1
GROUP BY provider
ORDER BY retry_count DESC;
```

#### First remediation steps

1. Check voice provider status and alerts
2. Implement circuit breaker to stop retries
3. Notify customers of voice service issues
4. Implement manual fallback procedures

#### Escalation path

- After 10 minutes: Page on-call engineer immediately
- After 30 minutes: Escalate to engineering leadership
