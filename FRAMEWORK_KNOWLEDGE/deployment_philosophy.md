# Deployment Philosophy — Safe and Reliable Deployments

## Overview

This document defines the deployment philosophy for the Autonomous Engineering OS. Deployments should be safe, predictable, and reversible with minimal risk and disruption.

---

## DEPLOYMENT PRINCIPLES

### Principle 1: Small, Frequent, Automated

**Approach**: Deploy small changes frequently through automated pipelines.

**Why**:
- Each deploy has smaller risk (fewer changes)
- Faster feedback on issues
- Easier to identify what caused problem
- Reduces merge conflicts

**Implications**:
- No big releases with thousands of changes
- Merge and deploy daily (or multiple times daily)
- Automate as much as possible
- Manual steps only when absolutely necessary

---

### Principle 2: Never Deploy Without Rollback Plan

**Approach**: Every deployment must have a clear rollback plan before execution.

**Why**:
- If something goes wrong, you can recover quickly
- Planning rollback ensures consideration of risks
- Reduces time to recover from incidents

**Rollback Planning**:

**Database Migrations**:
```yaml
BEFORE DEPLOYMENT:
  migration_up: migrations/001_add_user_status.up.sql
  migration_down: migrations/001_add_user_status.down.sql
  rollback_time: < 2 minutes

AFTER DEPLOYMENT:
  verify: SELECT COUNT(*) FROM users WHERE status IS NOT NULL
  rollback_command: psql -f migrations/001_add_user_status.down.sql
```

**Code Deployments**:
```yaml
BEFORE DEPLOYMENT:
  previous_version: v1.2.3
  new_version: v1.2.4
  rollback_command: git checkout v1.2.3 && deploy
  rollback_time: < 5 minutes
```

---

### Principle 3: Deploy Staging First

**Approach**: Always deploy to staging (or equivalent) before production.

**Why**:
- Catch issues before they affect real users
- Verify deployment process works
- Test with production-like data/configuration
- Gives human chance to review

**Staging Environment**:
- Mirror production configuration as closely as possible
- Use realistic (synthetic) data
- Run same monitoring/alerting
- Allow human to verify manually if needed

---

### Principle 4: Feature Flags for Risk Reduction

**Approach**: Use feature flags to enable/disable features without deploying.

**Why**:
- Can deploy code without releasing features
- Can quickly disable problematic features
- Allows gradual rollouts
- Can test in production with limited exposure

**Feature Flag Pattern**:

```python
# config.py
FEATURE_USER_DASHBOARD_V2 = os.getenv("FEATURE_USER_DASHBOARD_V2", "false") == "true"

# app/routes/dashboard.py
def get_dashboard(user_id: int):
    if config.FEATURE_USER_DASHBOARD_V2:
        return render_dashboard_v2(user_id)
    else:
        return render_dashboard_v1(user_id)
```

**Feature Flag Management**:
- Store in configuration (not hardcoded)
- Document each flag and its purpose
- Regularly audit and remove old flags
- Consider gradual rollout: 10% → 50% → 100%

---

## DEPLOYMENT ENVIRONMENTS

### Environment Definitions

**Development (dev)**:
- Purpose: Local development
- Access: Developer laptop
- Configuration: Local defaults
- Data: Fake/generated
- Deploy frequency: On every save (hot reload)

**Staging (staging)**:
- Purpose: Pre-production validation
- Access: Private URL, authentication
- Configuration: Mirrors production
- Data: Synthetic or anonymized subset
- Deploy frequency: Every merge to main

**Production (prod)**:
- Purpose: Real users
- Access: Public URL
- Configuration: Real API keys, secrets
- Data: Real user data
- Deploy frequency: After staging validation + approval

---

### Environment Configuration

**Best Practices**:
- Never commit secrets to repository
- Use environment variables for all sensitive config
- Document required environment variables in `.env.example`
- Validate configuration at startup

**Example**:
```python
# config.py
import os
from pydantic import BaseSettings

class Settings(BaseSettings):
    # Application
    app_name: str = "MyApp"
    environment: str = os.getenv("ENVIRONMENT", "development")

    # Database
    database_url: str = os.getenv("DATABASE_URL")

    # External APIs
    stripe_api_key: str = os.getenv("STRIPE_API_KEY")
    sendgrid_api_key: str = os.getenv("SENDGRID_API_KEY")

    # Feature Flags
    feature_new_ui: bool = os.getenv("FEATURE_NEW_UI", "false") == "true"

    class Config:
        env_file = ".env"

settings = Settings()

# Validate critical settings at startup
if settings.environment == "production":
    if not settings.database_url:
        raise ValueError("DATABASE_URL required in production")
```

---

## DEPLOYMENT STRATEGY

### Strategy 1: Blue-Green Deployment

**Description**: Maintain two identical production environments (blue and green). Switch between them.

**How It Works**:
1. Blue is live production
2. Deploy new version to Green
3. Verify Green works
4. Switch traffic from Blue to Green
5. Keep Blue as backup (immediate rollback)

**Pros**:
- Instant rollback (switch back)
- No downtime during deployment
- Can test new version with production config

**Cons**:
- Requires 2x production infrastructure
- Complex to set up
- Doubles infrastructure cost

**Use When**:
- High availability requirements
- Can afford 2x infrastructure
- Zero-downtime requirement

---

### Strategy 2: Rolling Deployment

**Description**: Gradually replace old instances with new instances.

**How It Works**:
1. Deploy to one instance/server
2. Verify it's healthy
3. Repeat for next instance
4. Continue until all instances updated

**Pros**:
- Lower infrastructure cost (no duplicate environment)
- Gradual risk exposure
- Can stop if problems detected

**Cons**:
- Slower than blue-green
- Potential for mixed versions during deploy
- Rollback requires re-deploying old version

**Use When**:
- Multiple instances/servers
- Can tolerate brief mixed-versions state
- Infrastructure cost sensitivity

---

### Strategy 3: Canary Deployment

**Description**: Deploy new version to small percentage of traffic, gradually increase.

**How It Works**:
1. Deploy new version
2. Route 1% of traffic to new version
3. Monitor metrics
4. If OK: increase to 5%, then 10%, then 100%
5. If problems: rollback immediately

**Pros**:
- Lowest risk (most users unaffected if issue)
- Gradual exposure catches edge cases
- Automatic rollback if metrics degrade

**Cons**:
- Requires sophisticated traffic routing
- Longer deployment time
- More complex monitoring needed

**Use When**:
- High-risk deployments
- Large traffic volume
- Critical user-facing features

---

## DEPLOYMENT PIPELINE

### CI/CD Flow

```
Code Push
    ↓
CI Builds and Tests
    ├─ Build
    ├─ Linting
    ├─ Unit Tests
    ├─ Integration Tests
    └─ Security Scan
    ↓
If all tests PASS → Staging Deploy
    ↓
Staging Validation
    ├─ Automated E2E Tests
    ├─ Performance Tests
    └─ Human Verification (optional)
    ↓
If Staging OK → Production Approval Gate
    ↓
[requires explicit approval]
    ↓
Production Deploy
    ├─ Deploy to portion of servers
    ├─ Health Checks
    └─ Monitor
    ↓
If Healthy → Full Rollout
    ↓
Deployment Complete
```

### Automated Deployment Steps

1. **Linting**: Check code style
2. **Type Checking**: Verify type correctness
3. **Unit Tests**: Run full test suite
4. **Integration Tests**: Verify API endpoints
5. **Security Scan**: Check for vulnerabilities
6. **Build**: Create deployable artifact
7. **Deploy to Staging**: Deploy to staging environment
8. **E2E Tests on Staging**: Verify critical user flows
9. **Performance Tests**: Confirm performance acceptable
10. **Production Deploy**: Deploy to production (with approval)
11. **Health Checks**: Verify deployment healthy
12. **Monitoring**: Watch for issues

---

## DATABASE DEPLOYMENTS

### Database Migration Philosophy

**Principle**: Database migrations are deployments too — treat with same care as code.

### Migration Types and Risk

| Migration Type | Risk | Rollback Complexity | Strategy |
|----------------|------|---------------------|----------|
| Add column | Low | Simple | Deploy before code |
| Rename column | High | Difficult | Add new, migrate, drop old |
| Add index | Medium | Simple | Can take time, monitor |
| Drop column | High | Difficult | Remove code first, then column |
| Add table | Low | Simple | Deploy before code |
| Drop table | Very High | Very Difficult | Remove code first, backup, verify |
| Change data type | High | Depends on data | Test thoroughly |

### Safe Migration Pattern

**1. Forward-Compatible First**:
```sql
-- Step 1: Add new column (non-breaking)
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';

-- Deploy code that uses new field
-- Deploy code that continues to work with old field
```

**2. Backfill Data**:
```sql
-- Step 2: Migrate data from old to new
UPDATE users SET status = 'active' WHERE is_active = true;
UPDATE users SET status = 'inactive' WHERE is_active = false;
```

**3. Deploy New Code**:
```python
# Code now uses status instead of is_active
def get_user_status(user_id):
    user = db.query(User).get(user_id)
    return user.status  # Uses new column
```

**4. Cleanup Later**:
```sql
-- Step 5: After verifying all good, remove old column
-- In a separate deployment, after verification period
ALTER TABLE users DROP COLUMN is_active;
```

---

## MONITORING AND ALERTING

### What to Monitor During Deployment

**Pre-Deployment Baseline**:
- Current error rate
- P50, P95, P99 latency
- Request rate
- Database connection pool utilization

**During Deployment**:
- Error rate (any spike?)
- Latency (degraded?)
- 5xx errors (sudden increase?)
- Database connection count (spike?)

**Post-Deployment**:
- Same metrics as baseline
- Compare to deployment window
- Check for gradual degradation

### Deployment Health Checks

```python
# /healthz endpoint
@app.get("/healthz")
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    checks = {
        "status": "ok",
        "database": check_database_connection(),
        "cache": check_cache_connection(),
        "version": get_app_version(),
    }

    all_healthy = all(check != "error" for check in checks.values())

    if not all_healthy:
        return Response(content=checks, status_code=503)

    return checks

# /readyz endpoint (ready to receive traffic)
@app.get("/readyz")
async def readiness_check():
    """Readiness check - is app ready to serve traffic?"""
    # Check: database migrations applied?
    # Check: warm cache populated?
    # Check: external services available?
    return {"status": "ready"}
```

---

## INCIDENT RESPONSE

### If Deployment Fails

**1. Stop the Deployment**:
- Cancel in-progress deployment
- Don't deploy further instances

**2. Rollback**:
- Execute pre-planned rollback immediately
- Restore previous version

**3. Investigate**:
- Review logs during failure
- Identify root cause
- Fix the issue

**4. Verify**:
- Confirm rollback successful
- Validate system healthy

**5. Re-Deploy**:
- After fix validated
- Follow same process (staging → production approval → deploy)

---

## DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] All tests passing in CI
- [ ] Code review completed
- [ ] Staging deployment successful
- [ ] Staging E2E tests passing
- [ ] Performance metrics acceptable
- [ ] Rollback plan documented and tested
- [ ] Database migrations reviewed
- [ ] Features behind feature flags if risky
- [ ] Monitoring/alerting configured for new features
- [ ] Runbook updated for new features
- [ ] Human approval obtained (per GUARDRAILS.md)
- [ ] Deployment scheduled during business hours (if non-emergency)
- [ ] Support team notified

---

## SUMMARY OF DEPLOYMENT PHILOSOPHY

| Aspect | Approach |
|--------|----------|
| **Frequency** | Small, frequent, automated deploys |
| **Safety** | Always have rollback plan; deploy to staging first |
| **Risk Reduction** | Use feature flags for risky changes |
| **Strategy** | Blue-green, rolling, or canary based on needs |
| **Pipeline** | Build → Test → Staging → Approval → Production |
| **Database** | Use forward-compatible migrations, backward-compatibility |
| **Monitoring** | Monitor during deploy, rollback on issues |

---

## VERSION HISTORY

- v1.0 (Initial): Safe deployment principles and strategies
