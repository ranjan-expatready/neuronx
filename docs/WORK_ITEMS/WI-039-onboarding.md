# WI-039: Customer Onboarding Golden Path (Enterprise-Ready)

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

NeuronX is technically complete but cannot be safely onboarded by enterprise customers without engineering involvement. The current system:

1. **No Repeatable Process**: Each customer requires custom setup and database manipulation
2. **No Safety Gates**: No way to verify tenant readiness before go-live
3. **No First Execution Protection**: No safeguards for initial customer interactions
4. **No Non-Engineering Path**: Solutions teams cannot onboard customers independently
5. **No Go-Live Confidence**: No systematic validation that everything works together

This prevents NeuronX from being a commercial product that sales teams can sell and customer success can deliver.

## Solution Overview

Create a complete, automated onboarding system that enables enterprise customers to go live safely in <60 minutes:

1. **Golden Path Documentation**: Step-by-step, non-technical onboarding guide
2. **Automated Bootstrap**: Single command to create complete org structure
3. **Readiness Validation**: Comprehensive checks before go-live
4. **First Execution Safety**: Special protections for initial customer interactions

**Non-Negotiable**: A brand-new enterprise tenant can be onboarded using only docs + scripts, no database access required.

## Acceptance Criteria

### AC-039.01: Golden Path Documentation

- [x] Complete step-by-step guide usable by non-engineers
- [x] Clear prerequisites and validation at each step
- [x] Rollback procedures for every operation
- [x] First execution walkthrough with safety measures
- [x] Success metrics and monitoring guidance

### AC-039.02: Automated Bootstrap Script

- [x] Single command creates complete org hierarchy (Enterprise → Agency → Teams)
- [x] Creates admin member with proper role assignments
- [x] Validates all org structure invariants
- [x] Dry-run mode for safe testing
- [x] Idempotent (safe to re-run)
- [x] Clear success/failure output with next steps

### AC-039.03: Readiness Validator

- [x] Comprehensive tenant state validation
- [x] Clear READY/BLOCKED status with remediation steps
- [x] Checks org hierarchy, integrations, data, and system components
- [x] Deterministic results (same input = same output)
- [x] Fast execution (<30 seconds)

### AC-039.04: First Execution Safety

- [x] Automatic detection of tenant's first execution
- [x] Mandatory LOW risk for first executions
- [x] Required detailed approval notes for first executions
- [x] Enterprise admin approval required for first executions
- [x] Special audit logging for first execution milestones

### AC-039.05: End-to-End Validation

- [x] Complete onboarding process tested with real tenant
- [x] All steps executable by solutions engineers
- [x] No database manual operations required
- [x] First customer execution completes safely
- [x] Operator UI shows correct scoped data immediately

## Technical Implementation

### Golden Path Documentation Structure

**Complete Onboarding Flow:**

1. **Environment Validation** (5 min): Readiness check confirms tenant setup
2. **Tenant Bootstrap** (15 min): Automated org structure creation
3. **GHL Integration Setup** (10 min): Location mappings and webhook configuration
4. **Data Migration** (10 min): Backfill opportunities with team assignments
5. **Go-Live Readiness Check** (5 min): Final validation before production
6. **First Execution Test** (5 min): Safe initial customer interaction

**Safety Features:**

- Every step has clear validation criteria
- Rollback procedures for every operation
- Emergency stop procedures
- Success metrics and monitoring guidance

### Bootstrap Script Architecture

**Command-Line Interface:**

```bash
# Dry run for validation
npm run bootstrap-tenant -- \
  --tenant-id YOUR_TENANT_ID \
  --org-name "Customer Company Name" \
  --admin-email "admin@customer.com" \
  --dry-run

# Execute bootstrap
npm run bootstrap-tenant -- \
  --tenant-id YOUR_TENANT_ID \
  --org-name "Customer Company Name" \
  --admin-email "admin@customer.com"
```

**Bootstrap Operations:**

1. **Validation**: Check tenant exists, no conflicting org structure
2. **Enterprise Creation**: Create enterprise entity with proper metadata
3. **Agency Creation**: Create primary sales agency
4. **Team Creation**: Create standard team structure (Inbound, Outbound, Enterprise)
5. **Admin Setup**: Create admin member and assign ENTERPRISE_ADMIN role
6. **Validation**: Verify all invariants (foreign keys, role assignments)
7. **Reporting**: Clear success/failure output with actionable next steps

**Idempotency Features:**

- Safe to re-run with same parameters
- Detects existing entities and reuses them
- Validates final state matches expectations
- Clear logging of what was created vs. reused

### Readiness Validator Architecture

**Validation Categories:**

- **Org Hierarchy**: Enterprise → Agency → Teams structure
- **Admin Setup**: Members and role assignments
- **Team Structure**: Proper agency assignments and coverage
- **GHL Integration**: Connection and webhook status
- **Integration Mappings**: Location-to-team mappings
- **Opportunity Data**: Volume and team assignment coverage
- **Playbook Setup**: Active playbooks and team bindings
- **Decision Engine**: Configuration and mode settings
- **Execution Authority**: Token configuration
- **Voice Adapter**: Provider setup and credentials

**Output Format:**

```json
{
  "tenantId": "tenant_123",
  "status": "READY", // or "BLOCKED"
  "checks": [
    {
      "name": "Org Hierarchy - Enterprise",
      "status": "PASS",
      "message": "Enterprise: Acme Corp",
      "details": { "enterpriseId": "ent_abc123" }
    }
  ],
  "summary": {
    "total": 12,
    "passed": 10,
    "failed": 2,
    "warnings": 0
  },
  "nextSteps": [
    "✅ Ready for production go-live",
    "Perform first execution test with low-value opportunity"
  ],
  "estimatedTimeToReady": "15-30 minutes"
}
```

**Deterministic Behavior:**

- Same tenant state always produces same validation result
- Clear remediation steps for each failure
- No false positives or negatives
- Fast execution for continuous integration

### First Execution Safety Implementation

**Automatic Detection:**

```typescript
// Check if tenant has any completed executions
const isFirstExecution = await this.isTenantFirstExecution(tenantId);

if (isFirstExecution) {
  // Apply special safety measures
  this.logger.log(`🎯 FIRST EXECUTION for tenant ${tenantId}`);
}
```

**Safety Measures:**

1. **Risk Level Enforcement**: First executions must be LOW risk
2. **Approval Requirements**: Detailed approval notes mandatory
3. **Authority Checks**: Enterprise admin approval required
4. **Audit Enhancement**: Special logging for first execution milestones
5. **Post-Execution Events**: Clear success indicators in logs

**Audit Trail:**

```json
{
  "eventType": "execution_completed",
  "details": {
    "firstExecution": true,
    "correlationId": "first_execution_test_001",
    "executedBy": {
      "userId": "admin@customer.com",
      "displayName": "Enterprise Admin",
      "authType": "admin_token"
    }
  }
}
```

## Artifacts Produced

### Code Artifacts

- [x] `docs/ONBOARDING/GOLDEN_PATH.md` - Complete onboarding documentation
- [x] `scripts/bootstrap-tenant.ts` - Automated tenant bootstrap script
- [x] `packages/onboarding-readiness/` - Readiness validation package
- [x] `apps/core-api/src/execution/execution.service.ts` - First execution safety logic

### Test Artifacts

- [x] Bootstrap script unit tests (idempotency, validation, error handling)
- [x] Readiness validator integration tests (all check categories)
- [x] First execution safety tests (risk enforcement, approval requirements)

### Documentation Artifacts

- [x] Step-by-step golden path with timing estimates
- [x] API reference for all bootstrap and validation endpoints
- [x] Troubleshooting guide for common onboarding issues
- [x] Success metrics and monitoring dashboards

## Dependencies

- **WI-035**: Org Authority (member and role management)
- **WI-036**: Principal Model (authenticated user context)
- **WI-037**: Team Binding (opportunity assignment infrastructure)
- **WI-038**: Admin Operations (mapping management and backfill)

## Risk Mitigation

### Operational Risks

- **Bootstrap Failures**: Idempotent script with comprehensive error handling
- **Invalid Configurations**: Readiness validator catches issues before go-live
- **First Execution Problems**: Mandatory safety measures prevent customer impact
- **Rollback Complexity**: Clear procedures for every operation type
- **Time Estimates**: Conservative timing with buffer for unexpected issues

### Security Risks

- **Unauthorized Bootstrap**: Admin-only permissions on bootstrap operations
- **Data Exposure**: Tenant isolation enforced throughout process
- **Configuration Tampering**: Validation of all created entities
- **Execution Bypass**: First execution safety cannot be circumvented
- **Audit Gaps**: Comprehensive logging of all onboarding operations

### Business Risks

- **Customer Downtime**: Readiness checks prevent premature go-live
- **Data Loss**: Idempotent operations prevent accidental overwrites
- **Compliance Issues**: Audit trails meet enterprise requirements
- **Support Burden**: Self-service onboarding reduces support tickets
- **Adoption Barriers**: Clear documentation enables solutions team independence

## Success Metrics

### Onboarding Success

- **Time to Go-Live**: <60 minutes from start to production
- **Bootstrap Success Rate**: 100% (no manual intervention required)
- **Readiness Validation**: 100% accurate (no false READY states)
- **First Execution Success**: 100% safe completions
- **Operator Adoption**: Teams see correct data within 5 minutes of go-live

### Operational Excellence

- **Process Repeatability**: Same steps work for all customer types
- **Error Recovery**: Clear rollback procedures for all failure modes
- **Audit Completeness**: 100% of onboarding actions fully traceable
- **Support Independence**: Solutions teams can onboard without engineering
- **Customer Satisfaction**: No production issues in first 24 hours

## Future Extensions

### Advanced Features

- **Multi-Environment Support**: Dev/staging/prod tenant configurations
- **Custom Org Templates**: Industry-specific team structures
- **Automated Data Migration**: Enhanced opportunity import capabilities
- **Integration Health Monitoring**: Continuous post-go-live validation
- **Onboarding Analytics**: Success metrics and improvement insights

### Enterprise Enhancements

- **SSO Integration**: Seamless identity provider setup
- **Audit Exports**: Compliance-ready audit trail exports
- **Custom Playbooks**: Automated playbook customization during bootstrap
- **Advanced Mappings**: Complex location-to-team mapping rules
- **Compliance Automation**: Industry-specific security configurations

## Implementation Notes

### Bootstrap Script Patterns

**Validation-First Approach:**

```typescript
// Always validate before creating
const existingEnterprise = await prisma.enterprise.findFirst({
  where: { tenantId: options.tenantId },
});

if (existingEnterprise && !options.force) {
  throw new Error(`Tenant already has org structure`);
}
```

**Comprehensive Error Handling:**

```typescript
try {
  // Operation
  result.actions.push(`Created Enterprise: ${enterprise.name}`);
} catch (error) {
  if (error.code === 'P2002') {
    result.errors.push('Enterprise name already exists');
  } else {
    result.errors.push(`Enterprise creation failed: ${error.message}`);
  }
}
```

### Readiness Check Optimization

**Fast Execution:**

- Database queries optimized with proper indexes
- Parallel validation where possible
- Cached results for repeated checks
- Early exit on critical failures

**Clear Remediation:**

```typescript
if (!enterprise) {
  return {
    name: 'Org Hierarchy - Enterprise',
    status: 'FAIL',
    message: 'No enterprise configured',
    remediation: 'Run bootstrap-tenant script to create enterprise',
  };
}
```

### First Execution Detection

**Efficient Checking:**

```typescript
// Use indexed queries for performance
const completedExecution = await auditService.findEvents({
  tenantId,
  eventType: 'execution_completed',
  limit: 1,
});

return completedExecution.length === 0;
```

**Safety Overrides:**

- Environment variable to disable first execution checks for testing
- Admin override capability for exceptional circumstances
- Clear audit logging of any overrides

This implementation transforms NeuronX from having "technical capabilities" to having "complete commercial onboarding" that enables sales teams to sell and customer success to deliver without engineering dependencies.
