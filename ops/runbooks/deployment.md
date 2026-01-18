# Deployment Runbook

**Purpose:** Safe, verifiable deployment of NeuronX to production environments.

## Pre-Deployment Checklist

### 🔧 Environment Preparation

- [ ] **CI Validation**: `npm run validate:release` passes
- [ ] **Environment Variables**: All required env vars configured in target environment
- [ ] **Database**: Target database is accessible and migrations are applied
- [ ] **Secrets**: All secrets (API keys, certificates) are properly configured
- [ ] **Storage**: S3/Local storage is configured and accessible
- [ ] **Redis**: Redis cluster is available (if used)

### 🚨 Safety Checks

- [ ] **Feature Flags**: All feature flags set to appropriate values for deployment
- [ ] **Database Backup**: Recent backup taken (automated via infrastructure)
- [ ] **Rollback Plan**: Rollback procedure reviewed and tested
- [ ] **Monitoring**: Alert contacts and escalation paths confirmed
- [ ] **Stakeholders**: Product/Engineering teams notified of deployment window

### 📊 Health Verification Queries

**Before Deployment:**

```bash
# Check current system health
curl -f https://api.neuronx.com/health/ready || exit 1

# Verify metrics endpoint (if accessible)
curl -f https://api.neuronx.com/metrics | grep -q "neuronx_outbox_pending_total" || exit 1
```

**Database Health:**

```sql
-- Check connection and basic functionality
SELECT version();

-- Verify recent activity
SELECT COUNT(*) as recent_events
FROM outbox_events
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check for any stuck processing
SELECT COUNT(*) as stuck_processing
FROM outbox_events
WHERE status = 'PROCESSING'
  AND created_at < NOW() - INTERVAL '10 minutes';
```

## Deployment Steps

### Phase 1: Pre-Deployment Validation

```bash
# 1. Run comprehensive validation
npm run validate:release

# 2. Test configuration with target environment values
NODE_ENV=production npm run validate:config

# 3. Verify database connectivity
npx prisma db push --preview-feature

# 4. Check storage access
# (Implementation-specific validation)
```

### Phase 2: Blue-Green Deployment

```bash
# 1. Deploy to staging environment first
kubectl set image deployment/neuronx-staging neuronx=neuronx:v1.2.3

# 2. Wait for staging to become ready
kubectl rollout status deployment/neuronx-staging

# 3. Run smoke tests against staging
npm run test:smoke -- --environment=staging

# 4. Deploy to production
kubectl set image deployment/neuronx neuronx=neuronx:v1.2.3

# 5. Wait for production rollout
kubectl rollout status deployment/neuronx
```

### Phase 3: Post-Deployment Verification

**Health Checks:**

```bash
# 1. Readiness probe
curl -f https://api.neuronx.com/health/ready

# 2. Liveness probe
curl -f https://api.neuronx.com/health/live

# 3. Application startup logs
kubectl logs -l app=neuronx --tail=50
```

**Metrics Verification:**

```promql
# Check that metrics are being collected
neuronx_outbox_publish_success_total > 0

# Verify no immediate error spikes
rate(neuronx_outbox_publish_fail_total[5m]) < 0.1

# Check queue backlogs are reasonable
neuronx_outbox_pending_total < 1000
neuronx_webhook_pending_total < 100
```

**Business Logic Verification:**

```bash
# Test basic API functionality
curl -X POST https://api.neuronx.com/leads \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "company": "Test Corp"}'

# Verify webhooks are being sent (if applicable)
# Check external integrations are working
```

### Phase 4: Monitoring & Alert Verification

**Dashboard Checks:**

- [ ] Grafana dashboards load and show data
- [ ] Key metrics are updating (outbox, webhooks, SLA)
- [ ] Error rates are within normal bounds
- [ ] Queue backlogs are decreasing over time

**Alert Verification:**

- [ ] No immediate alert firing after deployment
- [ ] Alert rules are correctly configured
- [ ] Alert contacts can receive notifications

## Success Criteria

**Technical:**

- ✅ All pods are Running and Ready
- ✅ Health endpoints return 200 OK
- ✅ Metrics are being collected and exposed
- ✅ No error spikes in logs or metrics
- ✅ Database connections are healthy

**Business:**

- ✅ API endpoints respond correctly
- ✅ Background jobs are processing (if enabled)
- ✅ External integrations work (if tested)
- ✅ No customer-impacting errors

**Monitoring:**

- ✅ Dashboards show expected data
- ✅ Alerts are not firing inappropriately
- ✅ Log aggregation is working

## Rollback Triggers

**Immediate Rollback (< 5 minutes):**

- Application fails to start
- Health checks consistently failing
- Critical database errors
- Authentication/authorization completely broken

**Fast Rollback (< 15 minutes):**

- Significant error rate increase (>50%)
- Core functionality broken
- External integrations failing
- Performance degradation (>50% slower)

**Gradual Rollback (< 1 hour):**

- Minor issues that can be monitored
- Feature flag controlled degradation
- Non-critical functionality issues

## Post-Deployment Tasks

### Monitoring Period (30 minutes)

- [ ] Monitor error rates and performance
- [ ] Watch queue backlogs
- [ ] Check external system integrations
- [ ] Verify customer-reported issues

### Documentation Updates

- [ ] Update deployment log with any issues encountered
- [ ] Document any environment-specific configurations
- [ ] Update runbook if new failure modes discovered

### Communication

- [ ] Notify stakeholders of successful deployment
- [ ] Update status pages if applicable
- [ ] Schedule post-mortem if issues occurred

## Deployment Metrics

**Track these for continuous improvement:**

- Deployment time
- Time to detect issues
- Rollback success rate
- Post-deployment incident rate
- Mean time to recovery

## Common Issues & Solutions

### Issue: Configuration validation fails

**Solution:** Check environment variables against schema requirements. Use `npm run validate:config` locally.

### Issue: Database migration fails

**Solution:** Verify database connectivity and permissions. Check migration scripts for syntax errors.

### Issue: Health checks fail after deployment

**Solution:** Check application logs for startup errors. Verify all dependencies (DB, Redis, Storage) are accessible.

### Issue: Metrics not appearing

**Solution:** Check Prometheus configuration and service discovery. Verify metrics endpoint is accessible.

### Issue: Background jobs not running

**Solution:** Check feature flags are enabled. Verify cron schedules and system readiness.
