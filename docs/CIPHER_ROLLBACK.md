# Cipher Rollback Procedures

## Overview

Cipher includes multiple layers of emergency controls and rollback procedures to ensure system stability and safety. These procedures allow for immediate deactivation if any issues arise during AI feature expansion.

## Quick Rollback Options

### Option 1: Environment Variable Toggle (Immediate)

```bash
# Disable Cipher completely
export CIPHER_ENABLED=false

# Restart core-api service
cd apps/core-api
pnpm run start:dev
```

**Effect**: Immediate deactivation, all Cipher checks bypassed
**Recovery Time**: ~30 seconds (service restart)
**Monitoring**: Check logs for "Cipher disabled" messages

### Option 2: Configuration File Toggle (Persistent)

```bash
# Edit policy file
vi config/cipher_policy.json

# Change this line:
"enabled": true,

# To:
"enabled": false,

# Restart service
cd apps/core-api
pnpm run start:dev
```

**Effect**: Persistent deactivation until manually re-enabled
**Recovery Time**: ~30 seconds (service restart)
**Monitoring**: Check service logs for policy reload confirmation

### Option 3: Circuit Breaker Auto-Rollback

Cipher automatically disables itself if:

- 5 consecutive decision failures occur
- Failures happen within a 10-minute window

**Effect**: Automatic protection against service degradation
**Recovery Time**: Immediate (no restart required)
**Monitoring**: Check logs for "Circuit breaker activated" messages

## Detailed Rollback Procedures

### Emergency Rollback (Production Impact)

**When to Use**: System performance degradation, incorrect decisions, or unexpected behavior

1. **Immediate Assessment** (2 minutes)

   ```bash
   # Check Cipher status
   curl http://localhost:3000/health

   # Check recent logs for Cipher issues
   tail -f logs/core-api.log | grep -i cipher
   ```

2. **Disable Cipher** (1 minute)

   ```bash
   export CIPHER_ENABLED=false
   # Restart service immediately
   ```

3. **Verify Recovery** (2 minutes)

   ```bash
   # Test core functionality
   ./scripts/demo/run_demo.sh

   # Check error rates return to normal
   # Monitor application performance
   ```

4. **Root Cause Analysis** (15 minutes)
   - Review Cipher logs for failure patterns
   - Check decision logs for anomalies
   - Analyze performance metrics during Cipher operation

5. **Gradual Re-enablement** (if desired)
   - Start with monitor mode only
   - Enable for 10% of decisions
   - Gradually increase scope while monitoring

### Planned Rollback (Maintenance Window)

**When to Use**: Scheduled deactivation for maintenance or policy updates

1. **Pre-Rollback Checklist**
   - [ ] Maintenance window scheduled
   - [ ] Stakeholders notified
   - [ ] Monitoring alerts configured
   - [ ] Rollback plan documented

2. **Configuration Backup**

   ```bash
   cp config/cipher_policy.json config/cipher_policy.json.backup
   ```

3. **Gradual Shutdown**

   ```bash
   # Reduce scope first
   vi config/cipher_policy.json
   # Set mode to "monitor" if currently "enforce"

   # Then disable
   # Set "enabled": false
   ```

4. **Service Restart**

   ```bash
   cd apps/core-api
   pnpm run build
   pnpm run start:prod
   ```

5. **Post-Rollback Validation**
   - [ ] All existing functionality works
   - [ ] Performance metrics normal
   - [ ] Error rates acceptable
   - [ ] Demo scripts pass

## Monitoring During Rollback

### Key Metrics to Watch

- **Application Performance**: Response times, error rates, CPU/memory usage
- **Business Metrics**: Lead qualification rates, opportunity creation rates
- **Cipher Metrics**: Decision counts, failure rates, processing times

### Alert Thresholds

- Error rate increase: >5% from baseline
- Response time increase: >50% from baseline
- Cipher decision failures: >10 per hour

### Log Monitoring

```bash
# Monitor for Cipher deactivation
tail -f logs/core-api.log | grep -E "(Cipher|cipher)"

# Check for decision logging stoppage
tail -f logs/core-api.log | grep "Cipher decision"
```

## Recovery and Re-enablement

### Post-Rollback Assessment

1. **Impact Analysis**
   - What functionality was affected?
   - How long was the impact?
   - What was the root cause?

2. **Fix Implementation**
   - Address root cause
   - Test fixes in staging environment
   - Update monitoring and alerting

3. **Gradual Re-enablement**

   ```bash
   # Start with monitor mode
   vi config/cipher_policy.json
   # Set "enabled": true, "mode": "monitor"

   # Enable minimal scope
   # Only lead_qualification checkpoint enabled

   # Monitor for 24 hours
   # Gradually increase scope based on stability
   ```

### Re-enablement Checklist

- [ ] Root cause identified and fixed
- [ ] Unit tests pass for Cipher functionality
- [ ] Integration tests pass
- [ ] Performance testing completed
- [ ] Monitoring alerts configured
- [ ] Rollback plan updated
- [ ] Stakeholders notified of timeline

## Contact Information

**Emergency Contacts:**

- Engineering Lead: eng-lead@neuronx.ai
- Security Team: security@neuronx.ai
- On-call Engineer: Current rotation

**Documentation:**

- Cipher Policy: `docs/CIPHER_POLICY.md`
- Activation Evidence: `docs/EVIDENCE/cipher_activation.txt`
- Runbook: This document

## Prevention Measures

To minimize rollback needs:

1. **Comprehensive Testing**: All Cipher changes require full test suite pass
2. **Gradual Rollout**: Start with monitor mode, then enforce mode
3. **Circuit Breakers**: Automatic protection against cascading failures
4. **Monitoring**: Real-time alerts for decision anomalies
5. **Staged Deployment**: Enable features incrementally

## Change Log

| Date       | Change                                 | Author           | Impact |
| ---------- | -------------------------------------- | ---------------- | ------ |
| 2026-01-03 | Initial rollback procedures documented | Engineering Team | None   |
