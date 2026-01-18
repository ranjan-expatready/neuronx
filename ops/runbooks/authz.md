# Authorization Runbook

## Overview

The authorization system handles API key validation and permission checking.

## Alerts

### InvalidApiKeySpike

**Threshold:** `increase(neuronx_auth_invalid_api_key_total[5m]) > 20` for 5 minutes

#### What this means

Spike in invalid API key authentication attempts.

#### Likely causes

1. **Credential rotation:** Recent API key changes not propagated
2. **Application bugs:** Clients using incorrect API keys
3. **Security incident:** Attempted unauthorized access
4. **Configuration issues:** API key storage problems

#### Immediate checks

```sql
SELECT ip, user_agent, COUNT(*) as attempts
FROM audit_logs
WHERE action = 'auth.invalid_api_key'
  AND created_at > NOW() - INTERVAL '5 minutes'
GROUP BY ip, user_agent
ORDER BY attempts DESC
LIMIT 10;
```

#### First remediation steps

1. Check for recent API key rotations
2. Monitor for security patterns
3. Implement rate limiting if needed
4. Notify affected customers

#### Escalation path

- After 5 minutes: Notify security team
- After 15 minutes: Page on-call engineer

---

### PermissionDeniedSpike

**Threshold:** `increase(neuronx_auth_permission_denied_total[5m]) > 50` for 5 minutes

#### What this means

Spike in permission denied events.

#### Likely causes

1. **Role changes:** Recent permission updates
2. **Application bugs:** Incorrect permission checks
3. **Configuration issues:** Permission mappings corrupted
4. **User errors:** Users attempting unauthorized actions

#### Immediate checks

```sql
SELECT actor_id, resource_type, COUNT(*) as denials
FROM audit_logs
WHERE action = 'auth.permission_denied'
  AND created_at > NOW() - INTERVAL '5 minutes'
GROUP BY actor_id, resource_type
ORDER BY denials DESC
LIMIT 10;
```

#### First remediation steps

1. Review recent permission changes
2. Check for application bugs
3. Validate role configurations
4. Implement temporary access if needed

#### Escalation path

- After 5 minutes: Notify customer success team
- After 15 minutes: Page on-call engineer
