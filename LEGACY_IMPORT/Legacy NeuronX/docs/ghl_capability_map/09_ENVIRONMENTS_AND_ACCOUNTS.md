# Environments and Accounts

**Last verified:** 2026-01-03
**Sources:** [GHL Agency Setup](https://help.gohighlevel.com/support/solutions/articles/48001144401-agency-setup), [GHL Account Structure](https://help.gohighlevel.com/support/solutions/articles/48001144289-what-is-a-sub-account-)

## GHL Account Hierarchy

### Agency (Top Level)

- **Definition:** Primary organizational container representing a business or agency
- **Purpose:** Manages billing, users, and cross-sub-account settings
- **Creation:** One agency per GHL account signup
- **Identity:** Unique agency ID and branding
- **Source:** [GHL Agency Overview](https://help.gohighlevel.com/support/solutions/articles/48001144401-agency-setup)

### Sub-Account/Location (Business Unit)

- **Definition:** Individual business locations, departments, or client accounts
- **Purpose:** Contains customer data, workflows, and operational settings
- **Creation:** Created within an agency (unlimited on higher plans)
- **Identity:** Separate branding, domain, and customer data
- **Source:** [GHL Sub-Accounts](https://help.gohighlevel.com/support/solutions/articles/48001144289-what-is-a-sub-account-)

### Data Isolation Model

- **Agency Level:** Users, billing, global settings, custom fields (shared across sub-accounts)
- **Sub-Account Level:** Contacts, opportunities, workflows, campaigns, communications
- **Security:** Complete data isolation between sub-accounts within same agency

## Environment Strategy

### Recommended: Separate Agencies per Environment

**Dev Agency:**

- Purpose: Development, testing, CI/CD pipelines
- Naming: `neuronx-dev-{team}` or `neuronx-development`
- Sub-accounts: Limited to plan constraints (3 on Starter)
- Data: Test data, can be safely deleted/modified

**Stage Agency:**

- Purpose: Staging, UAT, pre-production testing
- Naming: `neuronx-stage` or `neuronx-staging`
- Sub-accounts: Mirror production structure
- Data: Sanitized production-like data

**Prod Agency:**

- Purpose: Live customer data and operations
- Naming: `neuronx-prod` or `neuronx-production`
- Sub-accounts: Scale with customer base
- Data: Real customer data, backup requirements

### Alternative: Single Agency with Environment Prefixes

**When to Use:** Budget constraints or Starter plan limitations
**Structure:**

- Sub-accounts: `dev-{client}`, `stage-{client}`, `prod-{client}`
- **Risk:** Higher blast radius, data mixing concerns
- **Mitigation:** Strict naming conventions and access controls

### Blast Radius Assessment

| Strategy          | Dev Issue Impact | Stage Issue Impact | Prod Issue Impact |
| ----------------- | ---------------- | ------------------ | ----------------- |
| Separate Agencies | Single agency    | Single agency      | Single agency     |
| Single Agency     | All environments | All environments   | All environments  |
| **Risk Level**    | 🟢 Low           | 🟡 Medium          | 🔴 High           |

## Safe Operating Procedures

### Agency Creation and Management

**Creation Checklist:**

- [ ] Choose appropriate plan for environment needs
- [ ] Set up proper agency branding and contact info
- [ ] Configure billing alerts and notifications
- [ ] Document agency ID and access credentials
- [ ] Set up multi-factor authentication for admin accounts

**Access Control:**

- [ ] Use role-based access (Owner, Admin, Manager, User)
- [ ] Implement least-privilege access
- [ ] Regular access review and cleanup
- [ ] Separate admin accounts from development accounts

### Sub-Account Management

**Creation Standards:**

- [ ] Consistent naming: `{env}-{client}-{purpose}`
- [ ] Document sub-account ID and purpose
- [ ] Set up appropriate user permissions
- [ ] Configure location-specific settings

**Data Management:**

- [ ] Regular backup schedules for production data
- [ ] Data retention policies aligned with compliance
- [ ] Clean up test data regularly in dev/stage
- [ ] Audit trail for sensitive operations

### Environment Isolation

**Network Security:**

- [ ] Separate API keys per environment
- [ ] IP allowlisting for production access
- [ ] SSL/TLS enforcement on all connections
- [ ] Regular security audits and updates

**Operational Boundaries:**

- [ ] No cross-environment data transfers
- [ ] Separate monitoring and alerting per environment
- [ ] Environment-specific rate limiting and quotas
- [ ] Clear communication of environment context

## Naming Conventions

### Agency Naming

```
{product}-{environment}[-{variant}]
Examples:
- neuronx-dev
- neuronx-stage
- neuronx-prod
- neuronx-dev-team-a
```

### Sub-Account Naming

```
{env}-{client|purpose}[-{variant}]
Examples:
- dev-demo-client
- stage-acme-corp
- prod-enterprise-client
- dev-testing-sandbox
```

### User and Resource Naming

- **Users:** `{firstname}.{lastname}@{agency-domain}`
- **API Keys:** `{env}-{service}-{version}` (e.g., `prod-neuronx-v1`)
- **Webhooks:** Include environment in URL path or headers

## Migration and Scaling

### Environment Promotion

**Dev → Stage:**

- Export/import workflows and templates
- Migrate test data (sanitized)
- Update API endpoints and webhooks
- Verify integrations in stage environment

**Stage → Prod:**

- Full data migration planning
- Customer communication for downtime
- Rollback procedures documented
- Post-migration validation and monitoring

### Scaling Considerations

**Sub-Account Growth:**

- Monitor sub-account limits vs. current usage
- Plan for plan upgrades before hitting limits
- Implement automated sub-account creation for SaaS
- Archive inactive sub-accounts regularly

**Agency Scaling:**

- Single agency can support thousands of sub-accounts
- Performance monitoring for large agencies
- Geographic distribution if needed
- Backup and disaster recovery planning

## Monitoring and Alerting

### Key Metrics to Monitor

- **Agency Level:** Billing usage, user activity, API call volume
- **Sub-Account Level:** Data volume, workflow performance, integration health
- **Environment Level:** Cross-environment data consistency, access patterns

### Alert Conditions

- **High Priority:** API rate limit approaching, authentication failures
- **Medium Priority:** Unusual data access patterns, failed webhook deliveries
- **Low Priority:** Sub-account creation spikes, user permission changes

### Incident Response

- **Containment:** Isolate affected environment/agency
- **Investigation:** Review audit logs and access patterns
- **Recovery:** Restore from backups or recreate affected resources
- **Prevention:** Update security measures and access controls

## Compliance and Security

### Data Residency

- **Location:** GHL data centers in US/EU (confirm current locations)
- **Transfer:** Data transfer agreements for international customers
- **Compliance:** SOC 2, GDPR, CCPA compliance certifications

### Access Security

- **Authentication:** Email/password with 2FA required
- **Authorization:** Granular permissions per sub-account
- **Audit:** Complete audit trail of all user actions
- **Retention:** Configurable data retention policies

This environment and account strategy ensures safe, scalable development and operation of NeuronX across multiple GHL agencies while maintaining proper isolation and security boundaries.
