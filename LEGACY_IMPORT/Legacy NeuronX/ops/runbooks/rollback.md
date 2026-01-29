# Rollback Runbook

**Purpose:** Safe rollback procedures for NeuronX deployments.

## Rollback Strategies

### Strategy 1: Feature Flag Rollback (Preferred)

**When:** Non-breaking changes, configuration issues, feature-related problems
**Duration:** < 5 minutes

```bash
# Disable problematic features via environment variables
kubectl set env deployment/neuronx \
  OUTBOX_PROCESSING_ENABLED=false \
  WEBHOOK_PROCESSING_ENABLED=false \
  CLEANUP_ENABLED=false \
  VOICE_RETRY_ENABLED=false

# Verify flags took effect
kubectl exec -it deployment/neuronx -- env | grep _ENABLED

# Monitor system stabilization
# Re-enable features gradually
```

**Verification:**

```promql
# Check that background jobs stopped
rate(neuronx_outbox_publish_success_total[5m]) == 0

# Verify no new errors
increase(neuronx_outbox_publish_fail_total[5m]) == 0
```

### Strategy 2: Application Rollback

**When:** Breaking changes, startup failures, critical bugs
**Duration:** < 15 minutes

```bash
# 1. Identify previous working version
PREVIOUS_VERSION=$(kubectl get deployment neuronx -o jsonpath='{.spec.template.spec.containers[0].image}' | sed 's/:.*//'):v1.2.2

# 2. Rollback deployment
kubectl set image deployment/neuronx neuronx=$PREVIOUS_VERSION

# 3. Wait for rollout
kubectl rollout status deployment/neuronx

# 4. Verify rollback success
curl -f https://api.neuronx.com/health/ready
```

### Strategy 3: Database Rollback

**When:** Migration issues, data corruption
**Duration:** < 30 minutes

```bash
# 1. Stop all application instances
kubectl scale deployment neuronx --replicas=0

# 2. Restore from backup
# (Infrastructure-specific command)
pg_restore -d neuronx /path/to/backup.sql

# 3. Revert problematic migrations
npx prisma migrate reset --force

# 4. Restart application
kubectl scale deployment neuronx --replicas=3

# 5. Verify database integrity
npx prisma db push --preview-feature
```

## Rollback Decision Matrix

| Issue Severity | User Impact           | Rollback Strategy       | Timeline |
| -------------- | --------------------- | ----------------------- | -------- |
| Critical       | System down           | Application rollback    | < 5 min  |
| High           | Core features broken  | Feature flag rollback   | < 5 min  |
| Medium         | Partial functionality | Feature flag rollback   | < 10 min |
| Low            | Minor issues          | Monitor and fix forward | < 1 hour |

## Pre-Rollback Checklist

- [ ] **Confirm Issue:** Is rollback truly needed or can it be fixed forward?
- [ ] **Impact Assessment:** How many users/customers affected?
- [ ] **Data Safety:** Will rollback cause data loss?
- [ ] **Communication:** Stakeholders notified?
- [ ] **Rollback Plan:** Specific steps documented and rehearsed?

## Rollback Execution

### Phase 1: Preparation

```bash
# Create incident ticket
# Notify stakeholders
# Prepare rollback commands
# Verify backup availability
```

### Phase 2: Execution

```bash
# Execute chosen rollback strategy
# Monitor system during rollback
# Verify health checks pass
```

### Phase 3: Verification

```bash
# Health checks
curl -f https://api.neuronx.com/health/ready

# Business functionality tests
# External integration checks
# Performance validation
```

### Phase 4: Communication

```bash
# Update status pages
# Notify affected parties
# Schedule post-mortem
```

## Rollback Verification

### Technical Verification

```bash
# 1. Application health
kubectl get pods -l app=neuronx
kubectl logs -l app=neuronx --tail=20

# 2. Database connectivity
kubectl exec deployment/neuronx -- npx prisma db push --preview-feature

# 3. External dependencies
# Verify storage access
# Verify Redis connectivity (if used)
```

### Business Verification

```bash
# 1. API functionality
curl -X GET https://api.neuronx.com/leads \
  -H "Authorization: Bearer $TEST_TOKEN"

# 2. Background processing
# Check queue lengths are reasonable
# Verify no stuck jobs
```

### Monitoring Verification

```promql
# 1. Error rates returned to normal
rate(neuronx_outbox_publish_fail_total[5m]) < 0.1

# 2. Queue backlogs manageable
neuronx_outbox_pending_total < 1000

# 3. No new alert firing
```

## Post-Rollback Tasks

### Immediate (< 30 minutes)

- [ ] Monitor system stability
- [ ] Verify all functionality restored
- [ ] Update incident status
- [ ] Notify stakeholders of resolution

### Short-term (< 4 hours)

- [ ] Conduct post-mortem
- [ ] Identify root cause
- [ ] Implement preventive measures
- [ ] Update deployment procedures

### Long-term (< 1 week)

- [ ] Implement additional monitoring
- [ ] Update alert thresholds
- [ ] Improve testing procedures
- [ ] Update runbooks with lessons learned

## Common Rollback Scenarios

### Scenario 1: Failed Deployment

**Symptoms:** Application won't start, health checks fail
**Solution:** Application rollback to previous version
**Prevention:** Better pre-deployment testing

### Scenario 2: Performance Degradation

**Symptoms:** Response times > 5 seconds, error rates up
**Solution:** Feature flag rollback to disable problematic features
**Prevention:** Better load testing

### Scenario 3: Data Issues

**Symptoms:** Database errors, corrupted data
**Solution:** Database rollback + application rollback
**Prevention:** Better migration testing

### Scenario 4: External Integration Issues

**Symptoms:** Webhooks failing, external API errors
**Solution:** Feature flag rollback for integrations
**Prevention:** Better integration testing

## Rollback Metrics

**Track for improvement:**

- Rollback frequency
- Time to rollback
- Successful rollback rate
- Post-rollback stability
- Customer impact duration

## Prevention Strategies

### Testing Improvements

- [ ] Increase integration test coverage
- [ ] Add chaos engineering tests
- [ ] Implement canary deployments
- [ ] Add performance regression tests

### Monitoring Improvements

- [ ] Implement better health checks
- [ ] Add deployment-specific alerts
- [ ] Improve error tracking
- [ ] Add business metric monitoring

### Process Improvements

- [ ] Implement gradual rollouts
- [ ] Add automated rollback triggers
- [ ] Improve deployment validation
- [ ] Regular rollback drills

## Emergency Contacts

**Engineering On-Call:** @engineering-oncall
**Platform Team:** @platform-team
**Database Team:** @database-team
**Security Team:** @security-team

**Escalation Path:**

1. On-call engineer (immediate)
2. Engineering manager (< 15 min)
3. CTO (< 30 min)
4. CEO (< 1 hour)
