# SLA Runbook

## Overview

The SLA system manages time-based escalations and follow-ups for sales processes.

## Alerts

### SlaDueBacklogHigh

**Threshold:** `neuronx_sla_due_total > 50` for 10 minutes

#### What this means

More than 50 SLA timers are currently due for processing.

#### Likely causes

1. **Worker downtime:** SLA processing workers are not running
2. **Database issues:** Slow queries preventing timer processing
3. **High timer volume:** Sudden increase in SLA timer creation
4. **Lock contention:** Multiple workers competing for processing locks

#### Immediate checks

```promql
rate(neuronx_sla_escalations_success_total[5m])
rate(neuronx_sla_escalations_fail_total[5m])
```

```sql
SELECT status, COUNT(*) FROM sla_timers GROUP BY status;
SELECT COUNT(*) FROM sla_timers WHERE due_at < NOW() AND status = 'ACTIVE';
```

#### First remediation steps

1. Check SLA worker logs for errors
2. Verify database connectivity
3. Restart SLA processing workers if down
4. Scale workers if volume is high

#### Escalation path

- After 10 minutes: Page on-call engineer
- After 30 minutes: Escalate to platform team

---

### SlaEscalationFailures

**Threshold:** `increase(neuronx_sla_escalations_fail_total[15m]) > 0` for 15 minutes

#### What this means

SLA escalations are failing to execute.

#### Likely causes

1. **External system failures:** CRM or communication systems down
2. **Authentication issues:** Invalid credentials for escalation targets
3. **Template issues:** Escalation templates corrupted or missing
4. **Rate limiting:** Being throttled by target systems

#### Immediate checks

```sql
SELECT escalation_step, error_message, COUNT(*)
FROM sla_escalation_events
WHERE executed_at > NOW() - INTERVAL '15 minutes'
  AND outcome = 'FAILED'
GROUP BY escalation_step, error_message;
```

#### First remediation steps

1. Review escalation failure error messages
2. Check external system connectivity
3. Validate escalation templates and credentials
4. Implement manual escalation procedures if needed

#### Escalation path

- After 15 minutes: Notify sales operations team
- After 1 hour: Page on-call engineer
