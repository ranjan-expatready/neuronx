# WI-035: Tenant & Organization Authority Model

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

NeuronX has multi-channel execution authority and tokenized security, but lacks organizational governance. Without org hierarchy and authority controls:

1. **No Role-Based Access**: All operators have the same permissions regardless of org position
2. **No Approval Chains**: High-risk actions lack organizational approval workflows
3. **No Scope Isolation**: Operators can act on opportunities outside their org scope
4. **No Capability Governance**: Actions are approved based on technical risk alone, not organizational authority

This creates governance gaps where:

- Junior operators can approve enterprise-critical decisions
- Actions can be taken outside proper org scope
- No escalation paths for insufficient authority
- No audit trails of organizational approval chains

## Solution Overview

Implement complete organizational authority model with:

1. **Org Hierarchy**: Enterprise → Agency → Team structure
2. **Capability-Based Authorization**: Granular permissions by role
3. **Approval Chain Resolution**: Org-aware approval requirements
4. **Scope Enforcement**: Users can only act within their org scope
5. **Authority Integration**: Org checks before execution token issuance

**Non-Negotiable**: Org authority is checked BEFORE any execution action.

## Acceptance Criteria

### AC-035.01: Org Hierarchy & Membership (REQ-014)

- [x] Enterprise → Agency → Team hierarchy implemented
- [x] Members can be assigned to roles at any scope level
- [x] Role inheritance follows org hierarchy (enterprise > agency > team)
- [x] Admin endpoints exist for org structure management

### AC-035.02: Capability-Based Authorization

- [x] 6 roles defined: ENTERPRISE_ADMIN, AGENCY_ADMIN, TEAM_LEAD, OPERATOR, VIEWER, AUDITOR
- [x] 10+ capabilities mapped to roles with clear governance
- [x] Capability resolution from role assignments works correctly
- [x] Guards enforce capability requirements on endpoints

### AC-035.03: Approval Chain Resolution

- [x] Deterministic approval requirements based on action + risk + context
- [x] Deal value escalation (>100k requires higher approval)
- [x] Voice mode escalation (conversational requires high approval)
- [x] Required capabilities computed correctly for each scenario

### AC-035.04: Scope Enforcement

- [x] Users can only act on opportunities within their org scope
- [x] Direct scope access checked before actions
- [x] Parent scope implies child access (enterprise > agency > team)
- [x] Scope violations blocked with clear error messages

### AC-035.05: Execution Authority Integration

- [x] Org capability checks before execution token issuance
- [x] APPROVAL_REQUIRED mode routes to appropriate org approvers
- [x] Insufficient org authority blocks execution
- [x] Audit logs include org context and approval chains

## Technical Implementation

### Org Hierarchy Model

**Entities:**

```typescript
Enterprise { id, tenantId, name, description }
Agency { id, tenantId, enterpriseId, name, description }
Team { id, tenantId, agencyId, name, description }
OrgMember { id, tenantId, userId, displayName, email }
RoleAssignment { id, tenantId, memberId, role, scopeType, scopeId }
```

**Hierarchy Enforcement:**

- Enterprise scope grants access to all child agencies/teams
- Agency scope grants access to child teams
- Team scope grants access only to that team
- Cross-tenant access strictly prohibited

### Capability Mapping

**Role Hierarchy (highest to lowest):**

1. **ENTERPRISE_ADMIN**: All capabilities including system override
2. **AGENCY_ADMIN**: All except system-level, plus org management
3. **TEAM_LEAD**: Medium/high approvals, assistance, escalation
4. **OPERATOR**: Basic assistance, medium approvals, escalation
5. **AUDITOR**: Read + audit logs
6. **VIEWER**: Read-only

**Critical Capabilities:**

- `APPROVE_HIGH_RISK_EXECUTION`: Enterprise/agency admins
- `APPROVE_MEDIUM_RISK_EXECUTION`: Team leads and above
- `ASSIST_EXECUTION`: Operators and above
- `OVERRIDE_DECISION_ENGINE`: Enterprise admin only

### Approval Chain Logic

**Deterministic Rules:**

```typescript
// Risk-based approvals
LOW → No approval required
MEDIUM → APPROVE_MEDIUM_RISK_EXECUTION
HIGH → APPROVE_HIGH_RISK_EXECUTION
CRITICAL → APPROVE_HIGH_RISK_EXECUTION

// Escalation factors
dealValue >= 100000 → Escalate to high-risk approval
voiceMode == CONVERSATIONAL → Escalate to high-risk approval
channel == VOICE && risk >= MEDIUM → Require approval
```

**Escalation Paths:**

- Medium risk: OPERATOR → TEAM_LEAD → AGENCY_ADMIN
- High risk: TEAM_LEAD → AGENCY_ADMIN → ENTERPRISE_ADMIN
- Critical: AGENCY_ADMIN → ENTERPRISE_ADMIN

### Authority Resolution

**Context Building:**

```typescript
AuthorityContext = {
  tenantId,
  memberId,
  userId,
  roleAssignments[], // All active assignments
  resolvedCapabilities: Set<Capability>
}
```

**Scope Checking:**

```typescript
canActOnTeam(context, teamId) → Check direct or inherited access
canActOnAgency(context, agencyId) → Check direct or enterprise access
canActOnEnterprise(context, entId) → Check enterprise scope
```

### Integration Points

**Execution Token Issuance:**

```typescript
// Before issuing token
const approvalReq = orgAuthority.getApprovalRequirement(actionContext);
if (approvalReq.required) {
  await orgAuthority.requireCapability(
    userId,
    approvalReq.requiredCapabilities[0]
  );
}
```

**Operator UI Actions:**

```typescript
// Before APPROVE/ASSIST/ESCALATE
const context = await orgAuthority.getAuthorityContext(userId);
orgAuthority.assertSufficientAuthority(context, requiredCapabilities, scope);
```

## Artifacts Produced

### Code Artifacts

- [x] `packages/org-authority/` - Complete org authority package
- [x] `AuthorityResolver` - Capability and scope resolution
- [x] `ApprovalChainResolver` - Deterministic approval requirements
- [x] `CapabilityMap` - Role-to-capability mappings
- [x] `InMemoryOrgStore` - Org data management (scaffold)
- [x] `apps/core-api/src/org-authority/` - API integration
- [x] `CapabilityGuard` - Endpoint protection
- [x] `@RequireCapability` decorator - Clean API usage
- [x] `/api/org/*` endpoints - Admin org management

### Test Artifacts

- [x] Unit tests for capability resolution and scope checking
- [x] Approval chain determinism tests
- [x] Authority resolver boundary tests
- [x] Integration tests for execution authority hooks
- [x] Guard enforcement tests

### Documentation Artifacts

- [x] Capability matrix and role definitions
- [x] Approval chain decision tree
- [x] Org hierarchy and scope inheritance rules
- [x] Integration patterns for execution authority
- [x] Threat model for org authority bypass

## Dependencies

- **WI-027**: Stage Gate (provides stage context for approvals)
- **WI-029**: Decision Engine (provides risk assessments)
- **WI-032**: Operator UI (approval workflows)
- **WI-034**: Execution Authority (token issuance integration)

## Risk Mitigation

### Security Risks

- **Capability Bypass**: Guards + scope checks + comprehensive testing
- **Scope Violation**: Hierarchical access control + validation
- **Approval Bypass**: Deterministic requirements + audit logging
- **Role Escalation**: Strict role definitions + no dynamic role creation

### Operational Risks

- **Complex Org Structures**: Clear hierarchy rules + validation
- **Approval Bottlenecks**: Escalation paths + appropriate role distribution
- **Scope Confusion**: Clear error messages + audit trails
- **Authority Resolution Performance**: Efficient caching + optimization

## Success Metrics

- **Authority Accuracy**: 100% of actions properly scoped and capability-checked
- **Approval Compliance**: 100% of required approvals enforced
- **Scope Security**: 0 scope violation incidents
- **User Experience**: <2 second authority resolution time
- **Audit Coverage**: 100% of org decisions logged with full context

## Future Extensions

- Advanced approval workflows (parallel approvals, conditional logic)
- Dynamic role delegation during absences
- Org-specific approval policies
- Real-time authority monitoring dashboard
- Integration with external identity providers
- Audit analytics and compliance reporting

## Implementation Notes

### Database Schema (Future)

```sql
-- Org hierarchy
CREATE TABLE enterprises (id, tenantId, name, ...);
CREATE TABLE agencies (id, tenantId, enterpriseId, name, ...);
CREATE TABLE teams (id, tenantId, agencyId, name, ...);

-- Membership & roles
CREATE TABLE org_members (id, tenantId, userId, ...);
CREATE TABLE role_assignments (
  id, tenantId, memberId, role, scopeType, scopeId, ...
);

-- Indexes for performance
CREATE INDEX idx_role_assignments_scope ON role_assignments(tenantId, scopeType, scopeId);
```

### Feature Flags

```typescript
ORG_AUTHORITY_ENABLED = true; // Enable org authority checks
ORG_APPROVAL_CHAINS_ENABLED = true; // Enable approval requirements
ORG_SCOPE_ENFORCEMENT_ENABLED = true; // Enable scope restrictions
```

### Monitoring

```typescript
// Key metrics
neuronx_org_authority_checks_total{result}
// Approval chain metrics
neuronx_org_approvals_required_total{risk_level,action_type}
// Scope violation attempts
neuronx_org_scope_violations_total{scope_type}
```

This implementation establishes NeuronX as an enterprise-grade platform with proper organizational governance, ensuring actions are taken by appropriately authorized personnel within correct org scopes.
