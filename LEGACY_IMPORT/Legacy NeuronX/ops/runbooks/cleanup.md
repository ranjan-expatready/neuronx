# Cleanup Runbook

## Overview

The cleanup system performs automated data retention and deletion operations.

## Alerts

### CleanupLockSkippedOften

**Threshold:** `increase(neuronx_cleanup_lock_skipped_total[1h]) > 2` for 1 hour

#### What this means

Cleanup operations are frequently unable to acquire advisory locks.

#### Likely causes

1. **Long-running cleanups:** Previous cleanup operations taking too long
2. **Lock contention:** Multiple cleanup processes competing
3. **Deadlocks:** Cleanup operations getting stuck
4. **Resource constraints:** Database overloaded preventing lock acquisition

#### Immediate checks

```promql
histogram_quantile(0.95, rate(neuronx_cleanup_duration_ms_bucket[5m]))
rate(neuronx_cleanup_run_total[5m])
```

```sql
-- Check for long-running cleanup transactions
SELECT pid, query, state, now() - query_start as duration
FROM pg_stat_activity
WHERE query LIKE '%cleanup%' OR query LIKE '%DELETE%'
  AND state = 'active'
ORDER BY duration DESC;
```

#### First remediation steps

1. Check for stuck cleanup processes
2. Kill long-running cleanup transactions if safe
3. Adjust cleanup batch sizes to reduce runtime
4. Implement cleanup job staggering

#### Escalation path

- After 1 hour: Page on-call engineer
- After 2 hours: Escalate to platform team

---

### CleanupErrors

**Threshold:** `increase(neuronx_cleanup_errors_total[1h]) > 0` for 1 hour

#### What this means

Cleanup operations are failing with errors.

#### Likely causes

1. **Database issues:** Connection problems or constraint violations
2. **Foreign key issues:** Attempting to delete referenced records
3. **Storage failures:** Unable to delete associated files
4. **Permission issues:** Insufficient database permissions
5. **Data corruption:** Invalid data preventing deletion

#### Immediate checks

```sql
-- Check cleanup error details (assuming errors are logged)
SELECT table_name, error_message, COUNT(*)
FROM cleanup_error_logs -- Hypothetical table
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY table_name, error_message
ORDER BY COUNT(*) DESC;
```

#### First remediation steps

1. Review cleanup error logs and messages
2. Check database constraints and foreign keys
3. Verify storage connectivity for artifact cleanup
4. Implement manual cleanup procedures if needed
5. Temporarily disable problematic cleanup operations

#### Escalation path

- After 1 hour: Page on-call engineer
- After 2 hours: Escalate to platform team
