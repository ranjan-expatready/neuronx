# WI-036: Production Identity & Principal Model

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

NeuronX has sophisticated org authority and approval chains, but uses placeholder identity extraction. This creates critical security and audit gaps:

1. **No Attributable Identity**: Operator actions cannot be traced to specific authenticated users
2. **Inconsistent Principal Model**: API keys and admin tokens have different identity representations
3. **Missing Audit Context**: Authorization decisions lack proper user attribution
4. **Org Authority Bypass**: Placeholder identity prevents real org membership validation
5. **Enterprise Compliance Gap**: No way to prove "who approved what" in enterprise reviews

This prevents NeuronX from being enterprise-deployable where audit trails and user attribution are mandatory.

## Solution Overview

Implement production-ready identity and principal model:

1. **Principal Model**: Unified identity abstraction across auth methods
2. **Principal Extractor**: Clean extraction from authenticated requests
3. **Org Integration**: Principal-based org authority resolution
4. **Audit Attribution**: All actions attributable to authenticated principals
5. **Operator UI Integration**: Real identity flow to backend APIs

**Non-Negotiable**: Every operator action must be attributable to an authenticated principal.

## Acceptance Criteria

### AC-036.01: Principal Model Implementation

- [x] Principal interface defined with tenantId, userId, authType, correlationId
- [x] PrincipalExtractor extracts from API key and admin token actors
- [x] PrincipalContext provides request lifecycle management
- [x] Principal extraction throws clear errors for unauthenticated requests

### AC-036.02: Org Authority Integration

- [x] OrgAuthorityService accepts Principal instead of raw userId
- [x] Principal extraction from request context works
- [x] Authority context resolution uses real org membership
- [x] Capability enforcement uses authenticated principal identity

### AC-036.03: Operator Action Attribution

- [x] Execution approval endpoints use Principal for authorization
- [x] Execution execution endpoints attribute actions to principals
- [x] Audit logs include principal userId, displayName, authType
- [x] No placeholder identity usage remains

### AC-036.04: Authentication Flow Integration

- [x] AuthGuard sets Principal on request after successful authentication
- [x] API key authentication produces attributable principals
- [x] Admin token authentication produces attributable principals
- [x] Principal extraction fails gracefully for unauthenticated requests

### AC-036.05: Testing & Validation

- [x] Principal extraction tests for both auth methods
- [x] Org authority integration tests with real principals
- [x] Authentication guard tests verify principal setting
- [x] Error handling tests for missing/invalid principals

## Technical Implementation

### Principal Model

**Core Interface:**

```typescript
interface Principal {
  tenantId: string; // Tenant isolation
  userId: string; // Stable user identifier
  memberId?: string; // Org member link (if exists)
  authType: 'api_key' | 'admin_token'; // Auth method
  displayName?: string; // Human-readable name
  email?: string; // Contact info
  correlationId: string; // Request tracing
  metadata?: Record<string, any>; // Auth-specific data
}
```

**Authentication Method Mapping:**

- **API Key**: userId = apiKeyId, displayName = "API Key {name}"
- **Admin Token**: userId = extracted userId, displayName = "Admin {userId}"

### Principal Extraction Flow

**From Authenticated Request:**

```typescript
// AuthGuard sets actor on request
request.actor = { type: 'apikey', id: 'key_123', ... }

// PrincipalExtractor creates unified Principal
const { principal } = await principalExtractor.extract(request);

// PrincipalContext manages request lifecycle
PrincipalContext.setPrincipal(request, principal);
```

**Org Authority Resolution:**

```typescript
// OrgAuthorityService uses Principal
const context = await orgAuthority.getAuthorityContext(principal);

// Capability checks use resolved identity
await orgAuthority.requireCapability(principal, CAPABILITY);
```

### Operator Action Attribution

**Approval Endpoints:**

```typescript
@Post('approve')
async approveExecution(@Req() request: any) {
  const principal = PrincipalContext.requirePrincipal(request);

  // Use principal for authorization and audit
  await executionService.approveExecution(principal, planId, notes, correlationId);
}
```

**Audit Logging:**

```typescript
await auditService.logEvent({
  eventType: 'execution_approved',
  tenantId: principal.tenantId,
  userId: principal.userId,
  resourceId: planId,
  action: 'execution_approved',
  details: {
    approvedBy: {
      userId: principal.userId,
      displayName: principal.displayName,
      authType: principal.authType,
    },
    correlationId,
  },
});
```

### Error Handling

**Unauthenticated Requests:**

```typescript
// Guards fail early
if (!request.actor) {
  throw new ForbiddenException('Authentication required');
}

// Principal extraction fails
if (!request.principal) {
  throw new PrincipalExtractionError('Principal extraction failed');
}
```

**Org Membership Missing:**

```typescript
// Graceful degradation - continue with limited capabilities
if (!member) {
  logger.warn(`User ${principal.userId} not in org, limited capabilities`);
  return { ...context, resolvedCapabilities: new Set() };
}
```

## Artifacts Produced

### Code Artifacts

- [x] `apps/core-api/src/authz/principal.ts` - Principal model and context utilities
- [x] `apps/core-api/src/authz/principal.extractor.ts` - Principal extraction service
- [x] `apps/core-api/src/authz/auth.guard.ts` - Updated to set Principal on requests
- [x] `apps/core-api/src/org-authority/org-authority.service.ts` - Principal-based org authority
- [x] `apps/core-api/src/execution/execution.controller.ts` - Principal-attributed actions
- [x] `apps/core-api/src/execution/execution.service.ts` - Principal-based authorization

### Test Artifacts

- [x] `apps/core-api/src/authz/__tests__/principal.spec.ts` - Principal extraction tests
- [x] `apps/core-api/src/org-authority/__tests__/org-authority.service.spec.ts` - Org authority integration tests

### Documentation Artifacts

- [x] Principal model specification and auth method mapping
- [x] Org authority integration patterns
- [x] Audit attribution examples
- [x] Error handling and security considerations

## Dependencies

- **WI-022**: Existing auth system (API keys + admin tokens)
- **WI-035**: Org authority service (capability enforcement)
- **WI-034**: Execution authority (token issuance integration)

## Risk Mitigation

### Security Risks

- **Identity Spoofing**: Principal extraction validates auth method integrity
- **Session Hijacking**: Short-lived tokens + proper validation
- **Audit Tampering**: Immutable audit logs with principal attribution
- **Org Bypass**: Principal-based org membership validation
- **Auth Method Confusion**: Clear authType field prevents confusion

### Operational Risks

- **Auth Method Changes**: Principal model abstracts auth implementation
- **Identity Resolution Failures**: Graceful degradation with clear error messages
- **Performance Impact**: Efficient principal extraction and caching
- **Debugging Complexity**: Correlation IDs and detailed logging
- **User Experience**: Clear error messages for auth failures

## Success Metrics

- **Authentication Success**: >99.9% successful principal extraction for valid auth
- **Audit Attribution**: 100% of operator actions have principal attribution
- **Org Authority**: 100% of capability checks use real principal identity
- **Error Transparency**: Clear error messages for auth failures
- **Performance**: <10ms average principal extraction time

## Future Extensions

- JWT token support for Operator UI sessions
- Multi-factor authentication integration
- Principal delegation for service accounts
- Real-time authentication monitoring
- Advanced identity federation (SAML, OAuth)
- Principal session management with timeouts

## Implementation Notes

### Authentication Method Details

**API Key Authentication:**

- Principal.userId = apiKeyId (stable identifier)
- Principal.displayName = "API Key {apiKeyName}"
- Principal.authType = 'api_key'
- Metadata includes roleIds, permissions for audit

**Admin Token Authentication:**

- Principal.userId = extracted userId (from token or header)
- Principal.displayName = "Admin {userId}"
- Principal.authType = 'admin_token'
- Metadata includes role information

### Org Membership Resolution

**With Org Membership:**

```typescript
const member = await store.getMemberByUserId(tenantId, principal.userId);
if (member) {
  principal.memberId = member.id;
  // Full org authority resolution
}
```

**Without Org Membership:**

```typescript
// Continue with limited capabilities
// Log warning for audit
logger.warn(`Principal ${principal.userId} not in org structure`);
```

### Audit Trail Enhancement

**Before (Placeholder):**

```json
{
  "eventType": "execution_approved",
  "userId": "current_user",
  "details": { "correlationId": "corr_123" }
}
```

**After (Attributable):**

```json
{
  "eventType": "execution_approved",
  "userId": "user_123",
  "details": {
    "approvedBy": {
      "userId": "user_123",
      "displayName": "John Doe",
      "authType": "admin_token"
    },
    "correlationId": "corr_123"
  }
}
```

This implementation transforms NeuronX from having "theoretical authorization" to having "enterprise-grade identity and attribution" that enterprises can audit and trust.
