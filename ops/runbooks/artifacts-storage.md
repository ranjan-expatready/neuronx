# Artifacts & Storage Runbook

## Overview

The artifacts system manages file storage and retrieval with tenant isolation.

## Alerts

### StorageDeleteFailures

**Threshold:** `increase(neuronx_storage_delete_fail_total[15m]) > 0` for 15 minutes

#### What this means

Storage delete operations are failing.

#### Likely causes

1. **Storage provider issues:** S3 or local storage problems
2. **Permission issues:** Insufficient storage permissions
3. **Object not found:** Attempting to delete already deleted objects
4. **Network issues:** Connectivity problems with storage provider
5. **Rate limiting:** Storage provider throttling delete requests

#### Immediate checks

```promql
rate(neuronx_storage_delete_success_total[5m])
rate(neuronx_storage_delete_fail_total[5m])
```

```sql
SELECT tenant_id, object_key, COUNT(*) as failures
FROM artifact_records
WHERE deleted_at IS NOT NULL
  AND updated_at > NOW() - INTERVAL '15 minutes'
  AND object_key NOT LIKE '' -- Assuming failures are tracked
GROUP BY tenant_id, object_key
ORDER BY failures DESC
LIMIT 10;
```

#### First remediation steps

1. Check storage provider status
2. Verify storage credentials and permissions
3. Check network connectivity to storage provider
4. Implement retry logic for failed deletes
5. Clean up orphaned database records if needed

#### Escalation path

- After 15 minutes: Notify platform team
- After 1 hour: Page on-call engineer
