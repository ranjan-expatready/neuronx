# WI-038: Org Admin + Integration Mapping Ops Pack

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

NeuronX has sophisticated org structure and team binding, but lacks administrative interfaces to manage them in production. Without admin APIs:

1. **No Org Management**: Cannot create/manage enterprises, agencies, teams
2. **No Integration Mapping**: Cannot configure GHL location → team mappings
3. **No Backfill Capability**: Cannot assign teams to legacy opportunities
4. **No Team Reassignment**: Cannot move opportunities between teams safely
5. **Enterprise Onboarding Blocker**: Cannot provision org structure for new customers

This prevents NeuronX from being customer-onboardable, as every tenant needs org setup and data migration.

## Solution Overview

Implement complete administrative operations pack:

1. **Org CRUD APIs**: Admin endpoints for managing org hierarchy
2. **Integration Mapping APIs**: Configure provider-to-team mappings
3. **Backfill Runner**: Idempotent job to assign teams to existing opportunities
4. **Team Reassignment API**: Guarded API for moving opportunities between teams
5. **Comprehensive Auditing**: All operations logged with principal attribution

**Non-Negotiable**: All operations are tenant-safe, auditable, and properly authorized.

## Acceptance Criteria

### AC-038.01: Org CRUD APIs

- [x] Enterprise/Agency/Team creation endpoints with proper authorization
- [x] Member/role assignment endpoints
- [x] List/read endpoints for org structure
- [x] All operations audit-logged with principal attribution

### AC-038.02: Integration Mapping Management

- [x] Create/list/delete GHL location → team mappings
- [x] Provider-agnostic mapping schema (extensible to Salesforce, etc.)
- [x] Tenant-isolated mappings
- [x] CRUD operations with proper authorization

### AC-038.03: Backfill Runner

- [x] Idempotent runner for assigning teams to existing opportunities
- [x] Uses locationId/pipelineId for resolution
- [x] Batch processing with configurable limits
- [x] Dry-run mode for validation
- [x] Comprehensive statistics and error handling

### AC-038.04: Team Reassignment Workflow

- [x] PATCH /sales/opportunities/:id/reassign-team endpoint
- [x] Scope validation (users can only reassign within their authority)
- [x] Optional approval chain for high-risk reassignments
- [x] Complete audit trail of old/new team assignments

### AC-038.05: Security & Authorization

- [x] All endpoints require admin permissions
- [x] Principal-based authorization for reassignment scope
- [x] Tenant isolation enforced
- [x] Proper error messages for unauthorized operations

### AC-038.06: Testing & Validation

- [x] Integration mapping CRUD tests
- [x] Backfill runner idempotency and error handling tests
- [x] Reassignment permission and audit tests
- [x] End-to-end org provisioning flow tests

## Technical Implementation

### Org CRUD APIs

**OrgAuthorityController Extensions:**

```typescript
// Enterprise management
POST /org/enterprise
GET /org/enterprises

// Agency management
POST /org/agency
GET /org/agencies

// Team management
POST /org/team
GET /org/teams

// Member & role management
POST /org/members
POST /org/members/:id/roles
GET /org/role-assignments
DELETE /org/role-assignment/:id
```

**Authorization Pattern:**

```typescript
@RequirePermissions('admin:all') // For now - could be refined
async createEnterprise(@Body() body: CreateEnterpriseRequest) {
  // Implementation with audit logging
}
```

### Integration Mapping APIs

**Mapping Schema:**

```typescript
interface IntegrationMapping {
  tenantId: string;
  provider: 'ghl' | 'salesforce' | ...;
  locationId: string; // Provider-specific identifier
  teamId: string;
  agencyId?: string; // Derived from team
  description?: string;
}
```

**API Endpoints:**

```typescript
// Mapping management
POST /org/integrations/:provider/location-mappings
GET /org/integrations/:provider/location-mappings
DELETE /org/integrations/location-mappings/:id
```

**Example Usage:**

```bash
# Create GHL location mapping
POST /api/org/integrations/ghl/location-mappings
{
  "locationId": "loc_123",
  "teamId": "team_sales",
  "description": "Main sales office"
}

# List all GHL mappings
GET /api/org/integrations/ghl/location-mappings
```

### Backfill Runner

**Runner Configuration:**

```typescript
interface BackfillOptions {
  tenantId: string;
  dryRun?: boolean;
  batchSize?: number;
  maxRows?: number;
  correlationId: string;
}
```

**Backfill Process:**

```typescript
// Find unassigned opportunities
const opportunities = await prisma.opportunity.findMany({
  where: {
    tenantId,
    teamId: null,
    OR: [{ locationId: { not: null } }, { pipelineId: { not: null } }],
  },
  take: maxRows,
});

// For each opportunity, resolve team
for (const opp of opportunities) {
  const resolution = await teamResolver.resolveTeam({
    tenantId,
    provider: 'ghl',
    locationId: opp.locationId,
    pipelineId: opp.pipelineId,
  });

  if (resolution.teamId && !dryRun) {
    await prisma.opportunity.update({
      where: { id: opp.id },
      data: { teamId: resolution.teamId, agencyId: resolution.agencyId },
    });

    await auditService.logEvent({
      eventType: 'opportunity_team_backfilled',
      // ... audit details
    });
  }
}
```

**Backfill API:**

```typescript
POST /api/sales/opportunities/backfill-teams
{
  "dryRun": false,
  "batchSize": 100,
  "maxRows": 10000
}

GET /api/sales/opportunities/backfill-stats
```

### Team Reassignment API

**Reassignment Endpoint:**

```typescript
PATCH /sales/opportunities/:id/reassign-team
{
  "newTeamId": "team_enterprise",
  "reason": "High-value deal requires enterprise team",
  "requiresApproval": true
}
```

**Authorization Logic:**

```typescript
// Check scope to reassign FROM current team
if (currentOpportunity.teamId) {
  await orgAuthority.assertCanActOnTeam(context, currentOpportunity.teamId);
}

// Check scope to reassign TO new team
await orgAuthority.assertCanActOnTeam(context, newTeamId);

// Optional approval for high-risk reassignments
if (requiresApproval) {
  const approvalReq = orgAuthority.getApprovalRequirement({
    actionType: ActionType.ESCALATE,
    riskLevel: calculateRisk(currentOpportunity),
    dealValue: currentOpportunity.value,
  });

  if (approvalReq.required) {
    await orgAuthority.requireCapability(
      principal,
      approvalReq.requiredCapabilities[0]
    );
  }
}
```

**Audit Trail:**

```typescript
await auditService.logEvent({
  eventType: 'opportunity_team_reassigned',
  tenantId,
  userId: principal.userId,
  resourceId: opportunityId,
  details: {
    oldTeamId,
    newTeamId,
    oldAgencyId,
    newAgencyId,
    reason,
    dealValue: currentOpportunity.value,
    requiresApproval,
    correlationId,
  },
});
```

### Database Schema Extensions

**Opportunity Model Extension:**

```sql
model Opportunity {
  // ... existing fields ...
  locationId  String?  // GHL location ID for backfilling
  // ... existing teamId, agencyId fields ...

  @@index([tenantId, locationId]) // Backfill queries
}
```

**OrgIntegrationMapping Model:**

```sql
model OrgIntegrationMapping {
  id          String   @id @default(cuid())
  tenantId    String
  provider    String   // 'ghl', 'salesforce', etc.
  locationId  String   // Provider-specific identifier
  teamId      String
  agencyId    String?  // Derived from team relationship
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String

  // Relations
  team        Team     @relation(fields: [teamId], references: [id])
  agency      Agency?  @relation(fields: [agencyId], references: [id])

  // Constraints
  @@unique([tenantId, provider, locationId])
  @@index([tenantId, provider])
  @@index([teamId])
}
```

## Artifacts Produced

### Code Artifacts

- [x] `apps/core-api/prisma/schema.prisma` - locationId field + OrgIntegrationMapping model
- [x] `apps/core-api/src/org-authority/org-authority.controller.ts` - Integration mapping endpoints
- [x] `apps/core-api/src/org-authority/org-authority.service.ts` - Mapping CRUD operations
- [x] `apps/core-api/src/sales/sales.controller.ts` - Backfill and reassignment endpoints
- [x] `apps/core-api/src/sales/opportunity-team-backfill.runner.ts` - Backfill runner implementation
- [x] `apps/core-api/src/sales/opportunity.service.ts` - reassignTeam method

### Test Artifacts

- [x] `apps/core-api/src/org-authority/__tests__/integration-mapping.spec.ts` - Mapping CRUD tests
- [x] `apps/core-api/src/sales/__tests__/opportunity-team-backfill.spec.ts` - Backfill runner tests
- [x] `apps/core-api/src/sales/__tests__/opportunity-reassignment.spec.ts` - Reassignment tests

### Documentation Artifacts

- [x] Complete API reference for all new endpoints
- [x] Backfill runner usage and monitoring guide
- [x] Team reassignment authorization matrix
- [x] Integration mapping configuration guide

## Dependencies

- **WI-035**: Org Authority (capability checks and scope validation)
- **WI-036**: Principal Model (authenticated user context for auditing)
- **WI-037**: Team Binding (opportunity team assignment infrastructure)

## Risk Mitigation

### Security Risks

- **Unauthorized Org Modification**: Admin-only permissions on all endpoints
- **Cross-Tenant Data Leakage**: Tenant ID validation on all operations
- **Uncontrolled Reassignment**: Scope validation before team changes
- **Backfill Data Corruption**: Dry-run mode and comprehensive testing

### Operational Risks

- **Large Backfill Jobs**: Batch processing with configurable limits
- **Mapping Configuration Errors**: Audit logging and validation
- **Concurrent Modifications**: Database constraints prevent conflicts
- **Performance Impact**: Indexed queries and pagination

### Data Integrity Risks

- **Inconsistent Team Assignments**: Atomic updates with foreign key constraints
- **Lost Audit Events**: Synchronous audit logging with error handling
- **Backfill Idempotency**: Safe to rerun with duplicate detection
- **Schema Migration Issues**: Backward-compatible schema changes

## Success Metrics

- **Org Setup Time**: <30 minutes to provision complete org structure for new tenant
- **Backfill Success Rate**: >99% successful team assignments for mappable opportunities
- **Reassignment Safety**: 100% of reassignments within authorized scope
- **Audit Completeness**: 100% of admin operations fully audited
- **API Reliability**: >99.9% success rate for admin API calls

## Future Extensions

- Bulk org provisioning APIs
- Org template system for common structures
- Advanced mapping rules (geographic, product-based, etc.)
- Automated backfill scheduling
- Reassignment approval workflows
- Org structure visualization
- Multi-provider integration mappings

## Implementation Notes

### Migration Strategy

```sql
-- Add locationId to opportunities (nullable)
ALTER TABLE opportunities ADD COLUMN locationId TEXT;

-- Create integration mappings table
CREATE TABLE org_integration_mappings (...);

-- Add indexes for performance
CREATE INDEX idx_opportunity_location ON opportunities(tenantId, locationId);
CREATE INDEX idx_integration_mapping_lookup ON org_integration_mappings(tenantId, provider, locationId);

-- Backfill existing opportunities (optional)
-- Run backfill runner with dryRun=true first
```

### Monitoring & Alerting

```typescript
// Key metrics
neuronx_org_admin_operations_total{operation, status}
// Backfill progress
neuronx_backfill_opportunities_processed_total{status}
// Reassignment tracking
neuronx_opportunity_reassignments_total{reason}
// Mapping utilization
neuronx_integration_mappings_active_total{provider}
```

### Error Handling Patterns

```typescript
// Consistent error responses
{
  success: false,
  error: 'Integration mapping already exists for ghl:loc_123'
}

// Audit all failures
await auditService.logEvent({
  eventType: 'admin_operation_failed',
  details: { operation: 'create_integration_mapping', error: error.message }
});
```

### Authorization Patterns

```typescript
// Principal-based authorization
const principal = PrincipalContext.requirePrincipal(request);

// Scope validation
await orgAuthority.assertCanActOnTeam(
  await orgAuthority.getAuthorityContext(principal),
  teamId
);

// Capability checks
await orgAuthority.requireCapabilityFromRequest(request, CAPABILITY);
```

This implementation transforms NeuronX from having "theoretical org management" to having "complete enterprise administrative operations" that enable smooth customer onboarding and ongoing org management.
