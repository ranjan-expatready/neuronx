# ADR-0015: GHL Environment Strategy

## Status

Accepted

## Context

NeuronX requires isolated development, staging, and production environments for safe, reliable operation. GHL's agency-based architecture provides multiple options for environment isolation, each with different trade-offs in cost, complexity, and risk management.

### Business Requirements

- **Development Safety:** Changes in development must not affect production
- **Testing Fidelity:** Staging must accurately mirror production
- **Cost Efficiency:** Minimize infrastructure costs while maintaining safety
- **Operational Simplicity:** Clear separation and management processes

### GHL Architecture Constraints

- **Agency Level:** Top-level container with billing and global settings
- **Sub-Account Level:** Business units with isolated customer data
- **Plan Limits:** Starter plan caps sub-accounts at 3, Unlimited allows unlimited
- **Data Isolation:** Complete separation between sub-accounts within agency

### Alternative Approaches

#### Option A: Separate Agencies (Preferred)

- **Dev Agency:** Dedicated agency for development and testing
- **Stage Agency:** Dedicated agency for staging and UAT
- **Prod Agency:** Dedicated agency for production customers
- **Pros:** Maximum isolation, clear blast radius, plan flexibility
- **Cons:** Higher cost (3x plan fees), agency management overhead

#### Option B: Single Agency with Environment Prefixes

- **Structure:** dev-_, stage-_, prod-\* sub-account naming within one agency
- **Pros:** Cost-effective (single plan), simpler management
- **Cons:** Higher blast radius, data mixing risks, shared plan limits

#### Option C: Hybrid Approach

- **Dev:** Separate agency on Starter plan (cost-effective)
- **Stage/Prod:** Single agency on Unlimited plan (shared but isolated)
- **Pros:** Balanced cost and isolation
- **Cons:** Inconsistent architecture, complex management

## Decision

**Use separate agencies for dev/stage/prod environments (Option A).**

### Rationale

1. **Risk Mitigation:** Maximum isolation prevents development issues from affecting production
2. **Plan Flexibility:** Each environment can use appropriate pricing tier
3. **Operational Clarity:** Clear boundaries and responsibilities per environment
4. **Future Scaling:** Easy to add more environments or modify individual environment plans
5. **Compliance:** Better audit trails and data isolation for regulatory requirements

### Implementation Details

**Agency Structure:**

```
neuronx-dev     (Starter plan - $97/month)
├── dev-demo
├── dev-testing
└── dev-integration

neuronx-stage   (Unlimited plan - $297/month)
├── stage-client-a
├── stage-client-b
└── stage-validation

neuronx-prod    (Unlimited plan - $297/month)
├── prod-client-1
├── prod-client-2
└── prod-client-n...
```

**Naming Conventions:**

- Agencies: `{product}-{environment}`
- Sub-accounts: `{environment}-{client|purpose}[-{variant}]`
- API Keys: `{environment}-{service}-{version}`

**Plan Strategy:**

- **Development:** Starter plan (3 sub-account limit acceptable)
- **Staging:** Unlimited plan (need realistic multi-tenant testing)
- **Production:** Unlimited plan (no scaling limits for customer growth)

## Consequences

### Positive

- **Enhanced Safety:** Development issues cannot impact production
- **Flexible Scaling:** Each environment can scale independently
- **Clear Ownership:** Environment-specific teams and responsibilities
- **Cost Transparency:** Per-environment budgeting and cost tracking
- **Regulatory Compliance:** Better data isolation and audit capabilities

### Negative

- **Increased Cost:** 3x plan fees vs. single agency approach
- **Management Overhead:** Multiple agencies to monitor and maintain
- **Setup Complexity:** Initial configuration of multiple agencies
- **Resource Allocation:** Separate API keys and webhook configurations

### Risks and Mitigations

#### Risk: Higher Operational Cost

- **Impact:** 3x monthly plan fees
- **Mitigation:** Budget allocated, cost-benefit analysis shows safety value exceeds cost
- **Monitoring:** Regular cost reviews and optimization opportunities

#### Risk: Configuration Drift

- **Impact:** Environments become inconsistent over time
- **Mitigation:** Automated deployment pipelines, configuration as code
- **Monitoring:** Regular environment comparison and synchronization checks

#### Risk: Agency Management Complexity

- **Impact:** Multiple agencies to monitor and maintain
- **Mitigation:** Centralized management tools, automated health checks
- **Monitoring:** Unified dashboard for all environment status

## Alternatives Considered

### Single Agency Approach (Rejected)

**Reason:** Too high blast radius - a development issue could affect all environments
**Counter:** Cost savings not worth the operational risk
**Fallback:** Could migrate to hybrid if cost becomes prohibitive

### Hybrid Dev + Shared Stage/Prod (Not Chosen)

**Reason:** Inconsistent architecture creates confusion and operational complexity
**Counter:** Clean separation provides better development velocity and safety
**Fallback:** Could adopt if agency management becomes overwhelming

## Implementation Plan

### Phase 1: Setup (Week 1)

- [ ] Create dev agency on Starter plan
- [ ] Create stage agency on Unlimited plan
- [ ] Create prod agency on Unlimited plan
- [ ] Set up basic sub-account structure in each

### Phase 2: Configuration (Week 2)

- [ ] Configure API keys for each environment
- [ ] Set up webhook endpoints with environment prefixes
- [ ] Implement environment-specific monitoring
- [ ] Document access procedures and security measures

### Phase 3: Migration (Week 3)

- [ ] Migrate existing development work to dev agency
- [ ] Set up staging pipelines and validation
- [ ] Prepare production environment for launch
- [ ] Test cross-environment data isolation

### Phase 4: Operations (Ongoing)

- [ ] Implement automated environment health checks
- [ ] Set up cost monitoring and alerting
- [ ] Establish backup and disaster recovery procedures
- [ ] Regular security audits and access reviews

## Success Metrics

- **Safety:** Zero production incidents caused by development activities
- **Cost:** Total environment cost stays within budgeted amount
- **Efficiency:** Development velocity maintained or improved
- **Compliance:** All environments meet regulatory requirements
- **Reliability:** 99.9% uptime across all environments

## Monitoring and Alerting

- **Cost Thresholds:** Alerts at 80% of monthly budget per environment
- **API Limits:** Monitoring of rate limits and usage patterns
- **Data Consistency:** Automated checks for cross-environment data leakage
- **Performance:** Response time and error rate monitoring per environment

This decision establishes a solid foundation for safe, scalable NeuronX operations across isolated GHL environments while balancing cost and operational efficiency.
