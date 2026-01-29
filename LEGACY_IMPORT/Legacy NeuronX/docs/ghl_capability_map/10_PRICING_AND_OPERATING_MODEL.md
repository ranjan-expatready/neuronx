# Pricing and Operating Model

**Last verified:** 2026-01-03
**Sources:** [GHL Pricing](https://www.gohighlevel.com/pricing), [GHL Plan Comparison](https://www.gohighlevel.com/pricing-comparison), [GHL Agency Pro](https://www.gohighlevel.com/agency-pro)

## Official GHL Plans

### $97/month - Starter Plan

**Sub-Accounts:** 3 sub-accounts maximum (hard limit)
**Users:** Unlimited agency users
**Features:** Full CRM, marketing, and automation features
**API Access:** Full API access with standard rate limits
**Integrations:** All native integrations available
**Support:** Community support, email support

**Use Case:** Individual businesses, small agencies, or development/testing
**Limitation:** Cannot create more than 3 sub-accounts
**Source:** [Starter Plan Details](https://www.gohighlevel.com/pricing)

### $297/month - Unlimited Plan

**Sub-Accounts:** Unlimited sub-accounts
**Users:** Unlimited agency users
**Features:** All Starter features plus advanced automations
**API Access:** Full API access with higher rate limits
**Integrations:** All native integrations plus advanced options
**Support:** Priority email support, phone support available

**Use Case:** Growing agencies, medium businesses, production SaaS applications
**Scaling:** No artificial limits on sub-account creation
**Source:** [Unlimited Plan Details](https://www.gohighlevel.com/pricing)

### $497/month - Agency Pro Plan

**Sub-Accounts:** Unlimited sub-accounts
**Users:** Unlimited agency users
**White-labeling:** Full white-label capabilities (SaaS mode)
**API Access:** Highest rate limits, dedicated support
**Integrations:** All integrations plus premium options
**Support:** Priority phone support, dedicated account manager

**Use Case:** Large agencies, white-label SaaS providers, enterprise deployments
**Special Feature:** Complete rebranding and custom domain support
**Source:** [Agency Pro Details](https://www.gohighlevel.com/agency-pro)

## Downgrade Implications

### From Unlimited → Starter ($297 → $97)

**Immediate Effects:**

- **Sub-Account Cap:** Hard limit of 3 sub-accounts enforced
- **Existing Sub-Accounts:** If >3 sub-accounts exist:
  - Cannot create new sub-accounts
  - Existing sub-accounts remain functional
  - **Data Loss Risk:** No automatic data deletion, but new operations blocked

**Operational Impact:**

- **Immediate Blocking:** API calls to create new sub-accounts return errors
- **Existing Operations:** All existing sub-accounts continue working normally
- **Gradual Migration:** Must archive/delete sub-accounts to stay within limit

**Business Impact:**

- **SaaS Limitation:** Cannot onboard new customers if at sub-account limit
- **Development Blocking:** Cannot create test sub-accounts for development
- **Scaling Stopped:** Growth blocked until plan upgrade or cleanup

### Mitigation Strategy

**Before Downgrading:**

- [ ] Audit all active sub-accounts
- [ ] Archive unused sub-accounts (data preserved)
- [ ] Delete test/development sub-accounts
- [ ] Ensure ≤3 active sub-accounts remain
- [ ] Test critical workflows post-downgrade

**Post-Downgrade Monitoring:**

- [ ] Monitor for "sub-account limit exceeded" errors
- [ ] Have upgrade path ready for immediate reactivation
- [ ] Document workaround procedures for limit hits

## Cancellation Impact

### Account Cancellation Process

**Data Retention:**

- **Immediate Access:** All data remains accessible during billing period
- **Post-Cancellation:** UNKNOWN - Confirm current GHL data retention policy
- **Data Export:** Limited export capabilities before cancellation

**Access Timeline:**

- **During Period:** Full access until billing period ends
- **Grace Period:** UNKNOWN - Confirm if grace period exists
- **Final Deletion:** UNKNOWN - Timeline for permanent data deletion

**API Impact:**

- **Active Period:** All API calls continue working
- **Post-Cancellation:** API keys deactivated, 401 responses
- **Data Access:** No API access to historical data

### Recovery Options

**Reactivation:**

- **Same Account:** Can reactivate cancelled account (if within grace period)
- **Data Preservation:** Historical data may be recoverable
- **Cost Impact:** Prorated charges for reactivation

**Data Migration:**

- **Export Tools:** Limited built-in export capabilities
- **Third-Party Tools:** Zapier or custom scripts for data extraction
- **Timeline Pressure:** Must export before final deletion

## Recommended Strategy for NeuronX

### Development Environment

**Plan:** Starter ($97/month) - Acceptable if ≤3 sub-accounts needed
**Rationale:**

- Development typically needs 1-3 sub-accounts (dev, testing, demo)
- Cost-effective for non-production workloads
- Full feature access for integration testing

**Alternative:** Unlimited ($297/month) if >3 sub-accounts needed for comprehensive testing

### Staging Environment

**Plan:** Unlimited ($297/month) - Required for realistic testing
**Rationale:**

- Need to test multi-tenant scenarios with multiple sub-accounts
- Mirror production structure for accurate testing
- Avoid Starter limitations that don't exist in production

### Production Environment

**Plan:** Unlimited ($297/month) - Minimum for SaaS scaling
**Rationale:**

- No sub-account limits for customer growth
- Higher API rate limits for production load
- Priority support for business-critical operations

**Future Consideration:** Agency Pro ($497/month) when white-labeling features are needed

### Cost Optimization Strategy

**Monthly Cost Projection:**

- **Dev:** $97 (Starter) × 1 environment = $97
- **Stage:** $297 (Unlimited) × 1 environment = $297
- **Prod:** $297 (Unlimited) × 1 environment = $297
- **Total:** $691/month for full environment suite

**Scaling Considerations:**

- **Sub-Account Growth:** Monitor sub-account creation rates
- **API Usage:** Track rate limit consumption
- **Plan Upgrade Triggers:** Automatic alerts at 80% capacity

### Budgeting and Procurement

**Annual Planning:**

- **Contract Terms:** Month-to-month flexibility preferred
- **Budget Allocation:** Include 20% buffer for plan upgrades
- **Vendor Management:** Single point of contact for billing/support

**Procurement Process:**

- [ ] Business justification for each environment's plan
- [ ] Approval workflow for plan upgrades
- [ ] Cost center allocation and tracking
- [ ] Regular budget reviews and optimizations

## Migration Between Plans

### Upgrade Process

**Immediate Activation:** Upgrades take effect immediately
**Prorated Billing:** Charges adjusted for current billing period
**Feature Access:** New features available instantly
**No Data Migration:** All existing data remains accessible

### Downgrade Planning

**Timeline:** Plan changes effective at next billing cycle
**Communication:** Advance notice to all stakeholders
**Testing:** Validate critical workflows on target plan
**Rollback Plan:** Ability to immediately upgrade back if issues

## Compliance and Legal

### Data Ownership

- **Customer Data:** Customers own their data within sub-accounts
- **Agency Data:** Agency owns user accounts and global configurations
- **Export Rights:** Customers can export their data at any time

### Service Level Agreements

- **Uptime:** UNKNOWN - Check current SLA commitments
- **Support:** Varies by plan (email vs phone vs dedicated)
- **Incident Response:** UNKNOWN - Confirm incident notification process

### Termination Clauses

- **Notice Period:** UNKNOWN - Confirm cancellation notice requirements
- **Data Export:** UNKNOWN - Timeline for data export post-cancellation
- **Final Invoice:** Includes any outstanding charges

This pricing and operating model provides the foundation for sustainable NeuronX operations on GHL's platform, balancing cost efficiency with scaling requirements and business continuity.
