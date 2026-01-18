# WI-037: Opportunity → Team Binding (Scope Becomes Real)

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

NeuronX has sophisticated org authority and approval chains, but scope enforcement is theoretical. Without real opportunity-to-team binding:

1. **Scope Bypass**: Operators can approve/execute opportunities outside their org scope
2. **Work Queue Pollution**: Operators see opportunities they cannot act upon
3. **Governance Gap**: No enforcement that actions happen within proper org boundaries
4. **Audit Incompleteness**: No way to prove org scope compliance in enterprise reviews

This prevents NeuronX from being enterprise-deployable where org scope isolation is mandatory.

## Solution Overview

Implement complete opportunity-to-team binding with scope enforcement:

1. **Team Resolution**: Deterministic mapping from GHL location/pipeline to org teams
2. **Ingestion Binding**: All opportunities bound to teams during creation
3. **Approval Enforcement**: Operators can only approve opportunities in their scope
4. **Execution Enforcement**: Token execution blocked outside operator scope
5. **Work Queue Filtering**: Operators only see opportunities they can act upon

**Non-Negotiable**: Every opportunity belongs to a team, and operators can only work within their scope.

## Acceptance Criteria

### AC-037.01: Team Resolution & Binding

- [x] GHL locationId/pipelineId deterministically map to teamId during opportunity ingestion
- [x] OrgIntegrationMapping table provides mapping source of truth
- [x] TeamResolverService handles fallback logic for unmapped locations
- [x] All new opportunities have teamId/agencyId populated
- [x] Audit events logged for team binding decisions

### AC-037.02: Approval Scope Enforcement

- [x] Execution approvals check operator scope against opportunity team
- [x] Cross-team approvals blocked with clear error messages
- [x] Enterprise/agency admins can approve across teams in their scope
- [x] Unassigned opportunities cannot be approved (require admin intervention)

### AC-037.03: Execution Scope Enforcement

- [x] Token execution validates executor scope against opportunity team
- [x] Cross-scope executions blocked before side effects occur
- [x] Scope validation includes inherited enterprise/agency access
- [x] Audit logs include scope validation results

### AC-037.04: Work Queue Scope Filtering

- [x] Work queue items filtered by operator's accessible team scopes
- [x] Enterprise admins see all opportunities in their enterprise
- [x] Agency admins see opportunities in their agency (including unassigned)
- [x] Team operators see only opportunities in their assigned teams
- [x] Unassigned opportunities only visible to enterprise/agency admins

### AC-037.05: Fallback & Error Handling

- [x] Unmapped GHL locations log warnings but don't block opportunity creation
- [x] Unassigned opportunities tagged for admin review
- [x] Clear error messages for scope violations
- [x] Audit trails for all scope decisions and violations

## Technical Implementation

### Team Resolution Architecture

**OrgIntegrationMapping Table:**

```sql
model OrgIntegrationMapping {
  tenantId    String
  provider    String   // 'ghl'
  locationId  String   // GHL location ID
  agencyId    String?  // Maps to Agency
  teamId      String   // Maps to Team (required)

  @@unique([tenantId, provider, locationId])
}
```

**Resolution Logic:**

```typescript
// Priority: locationId > pipelineId > fallback
const resolution = await teamResolver.resolveTeam({
  tenantId,
  provider: 'ghl',
  locationId: opportunity.locationId,
  pipelineId: opportunity.pipelineId
});

// Result includes confidence score and source
{
  agencyId: 'agency_1',
  teamId: 'team_1',
  resolutionSource: 'mapping', // 'mapping' | 'default' | 'fallback'
  confidence: 0.95
}
```

### Scope Enforcement Logic

**Approval Scope Check:**

```typescript
// Load opportunity team
const opportunity = await prisma.opportunity.findUnique({
  where: { id: planId },
  select: { teamId: true },
});

// Check operator scope
await orgAuthority.assertCanActOnTeam(authorityContext, opportunity.teamId);
```

**Work Queue Filtering:**

```typescript
// Get operator's accessible scopes
const accessibleScopes = await getAccessibleScopes(authorityContext);

// Filter opportunities
const opportunities = await prisma.opportunity.findMany({
  where: {
    tenantId,
    teamId: { in: accessibleScopes.teams },
    // Include unassigned for agency+ admins
    OR:
      accessibleScopes.agencies.length > 0
        ? [
            { teamId: { in: accessibleScopes.teams } },
            { teamId: null, agencyId: { in: accessibleScopes.agencies } },
          ]
        : undefined,
  },
});
```

### Inheritance & Access Control

**Scope Hierarchy:**

```
Enterprise (ent_1)
├── Agency (agy_1) - ent_1
│   ├── Team (team_1) - agy_1
│   ├── Team (team_2) - agy_1
│   └── Unassigned opportunities - agy_1 scope
└── Agency (agy_2) - ent_1
    └── Team (team_3) - agy_2
```

**Access Rules:**

- **Enterprise Admin**: Access to all teams/agencies in enterprise
- **Agency Admin**: Access to all teams in agency + unassigned opportunities
- **Team Lead/Operator**: Access only to assigned teams
- **No Access**: Clear error messages with escalation instructions

### Fallback Handling

**Unmapped Locations:**

```typescript
try {
  const resolution = await teamResolver.resolveTeam(input);
  // Bind to resolved team
} catch (error) {
  // Log warning, create unassigned opportunity
  await auditService.logEvent({
    eventType: 'opportunity_team_unassigned',
    reason: 'No team mapping found for location',
    locationId: input.locationId,
  });
}
```

**Unassigned Opportunities:**

- Cannot be approved by regular operators
- Visible only to enterprise/agency admins
- Tagged for admin review and manual assignment
- Audit trail tracks unassigned status

## Artifacts Produced

### Code Artifacts

- [x] Prisma schema: Opportunity.agencyId/teamId + OrgIntegrationMapping table
- [x] `apps/core-api/src/sales/opportunity.service.ts` - Team binding during creation
- [x] `apps/core-api/src/org-authority/team-resolver.service.ts` - Deterministic resolution
- [x] `apps/core-api/src/execution/execution.service.ts` - Scope checks in approvals/execution
- [x] `apps/core-api/src/work-queue/work-queue.service.ts` - Scope-filtered work queues

### Test Artifacts

- [x] `apps/core-api/src/execution/__tests__/execution-scope.spec.ts` - Scope enforcement tests
- [x] `apps/core-api/src/work-queue/__tests__/work-queue-scope.spec.ts` - Work queue filtering tests

### Documentation Artifacts

- [x] Team resolution mapping rules and fallback logic
- [x] Scope inheritance and access control matrix
- [x] Work queue filtering behavior by role
- [x] Error handling and audit trail specifications

## Dependencies

- **WI-027**: Stage Gate (provides stage context for approvals)
- **WI-034**: Execution Authority (token issuance with scope checks)
- **WI-035**: Org Authority (capability + scope resolution)
- **WI-036**: Identity & Principal (authenticated user context)

## Risk Mitigation

### Security Risks

- **Scope Bypass**: Comprehensive scope checking at approval/execution boundaries
- **Team Mapping Attacks**: Deterministic resolution with audit logging
- **Work Queue Pollution**: Strict filtering prevents unauthorized visibility
- **Unassigned Exploitation**: Unassigned opportunities blocked from regular operations

### Operational Risks

- **Mapping Maintenance**: Clear admin interfaces for mapping management
- **Unassigned Backlog**: Monitoring and alerting for unassigned opportunities
- **Scope Confusion**: Clear error messages and audit trails
- **Performance Impact**: Indexed queries and caching for scope resolution

## Success Metrics

- **Scope Compliance**: 100% of approvals/executions within operator scope
- **Work Queue Accuracy**: 100% of visible opportunities actionable by operator
- **Team Binding Coverage**: >95% of opportunities automatically bound to teams
- **Audit Completeness**: 100% of scope decisions logged with full context
- **Error Transparency**: Clear messages for all scope violations

## Future Extensions

- Advanced team mapping rules (geographic, product-based, etc.)
- Dynamic team reassignment workflows
- Team capacity and load balancing
- Cross-team collaboration with explicit permissions
- Team performance analytics and optimization
- Integration with external org charts (Workday, etc.)

## Implementation Notes

### Database Indexes

```sql
-- Opportunity scope filtering
CREATE INDEX idx_opportunity_team_scope ON opportunities(tenantId, teamId, updatedAt);
CREATE INDEX idx_opportunity_agency_scope ON opportunities(tenantId, agencyId, updatedAt);

-- Integration mapping lookups
CREATE INDEX idx_integration_mapping_lookup ON org_integration_mappings(tenantId, provider, locationId);
CREATE INDEX idx_integration_mapping_team ON org_integration_mappings(teamId);
```

### Migration Strategy

```sql
-- Add team binding columns (already in schema)
ALTER TABLE opportunities ADD COLUMN agencyId TEXT REFERENCES agencies(id);
ALTER TABLE opportunities ADD COLUMN teamId TEXT REFERENCES teams(id);

-- Create integration mapping table
CREATE TABLE org_integration_mappings (...);

-- Populate initial mappings (admin task)
-- Backfill existing opportunities (migration script)
```

### Monitoring

```typescript
// Key metrics
neuronx_org_scope_checks_total{result}
// Team binding coverage
neuronx_opportunity_team_binding_total{status}
// Work queue filtering
neuronx_work_queue_scope_filtering_total{role,scope_type}
// Unassigned opportunities
neuronx_opportunity_unassigned_total{reason}
```

This implementation transforms NeuronX from having "theoretical org scope" to having "enforced enterprise boundaries" where every action is properly scoped and auditable.
