# WI-066B: UAT Harness Hardening

## Objective

Complete the hardening of WI-066 UAT Harness to eliminate all production risks, ensure server-side authority, and provide comprehensive audit capabilities. Transform the UAT system from a "working prototype" to a "production-safe testing environment".

## Context

WI-066 implemented the initial UAT harness but had gaps:

- UI mock APIs bypassed server authority
- Golden run logic in scripts (not Core API)
- Audit logging was ephemeral (logs, not database)
- Safety guards were incomplete

This hardening ensures ZERO production corruption risk and absolute NeuronX authority.

## Scope

### In Scope

- Remove all UI mock APIs and client-side logic
- Move golden run execution to Core API services
- Implement durable audit persistence in database
- Complete UAT safety guard enforcement
- Ensure UI is purely server-driven
- Add comprehensive acceptance tests
- Update documentation and evidence

### Out of Scope

- Changing UAT business logic (explain → plan → approve → execute)
- Modifying UAT environment configuration
- Adding new UAT features
- UI redesign (only authority flow changes)

## Implementation Details

### 1. Remove ALL UI Mock APIs

#### Before (❌ VIOLATION)

```
apps/operator-ui/app/api/uat/
├── status/route.ts       # Mock API
└── golden-run/route.ts   # Mock API

apps/operator-ui/app/operator/components/UatBanner.tsx
├── fetchUatStatus() → fetch('/api/uat/status')  # Calls mock
└── runGoldenRun() → fetch('/api/uat/golden-run') # Calls mock
```

#### After (✅ AUTHORITY)

```
# Removed: apps/operator-ui/app/api/uat/

apps/operator-ui/lib/api-client.ts
├── uatApi.getStatus() → http://localhost:3001/uat/status
└── uatApi.triggerGoldenRun() → http://localhost:3001/uat/golden-run

apps/operator-ui/app/operator/components/UatBanner.tsx
├── fetchUatStatus() → uatApi.getStatus()
└── runGoldenRun() → uatApi.triggerGoldenRun()
```

**Impact**: UI now calls Core API directly, ensuring all logic and authority remains server-side.

### 2. Core API Owns Golden Run

#### Before (❌ BYPASSED)

```
scripts/uat/golden-run.ts
├── Main logic here
├── Calls various services
└── Scripts execute directly
```

#### After (✅ AUTHORITY)

```
apps/core-api/src/uat/
├── golden-run.service.ts     # Complete workflow logic
├── golden-run.controller.ts  # REST API endpoint
└── uat.guard.ts             # Safety enforcement

@UseGuards(UatGuard)
@Controller('uat/golden-run')
export class GoldenRunController {
  @Post()
  async triggerGoldenRun() {
    return this.goldenRunService.executeGoldenRun();
  }
}
```

**Flow**: Scripts can CALL the API, but NEVER execute logic directly.

### 3. Durable Audit Persistence

#### Before (❌ LOGS ONLY)

```
this.logger.log('UAT Guard Check: ALLOWED');
// Logs disappear, no persistence
```

#### After (✅ DATABASE)

```
await this.auditService.logEvent(
  'uat_guard_check_allowed',
  {
    endpoint: '/uat/status',
    guardResult: { allowed: true, mode: 'dry_run' },
    correlationId,
    isDryRun: true,
  },
  'uat-guard',
  tenantId
);

// Stored in audit_log table permanently
```

#### Audit Schema

```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255),
  actor_id VARCHAR(255),
  actor_type VARCHAR(50),
  action VARCHAR(255),           -- 'uat_guard_check_allowed'
  resource VARCHAR(100),         -- 'uat'
  resource_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,               -- correlationId, isDryRun, etc.
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Query API

```typescript
// Get UAT audit events
GET /uat/audit?tenantId=uat-001&limit=50

Response: {
  events: [{
    id: 123,
    action: 'uat_golden_run_phase_execute',
    timestamp: '2026-01-06T10:30:00Z',
    correlationId: 'golden_run_123',
    details: { phase: 'execute', successCount: 3 }
  }],
  total: 47
}
```

### 4. Hard Blocking Safety Guards

#### UAT Guard Enforcement

```typescript
@Injectable()
export class UatGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const tenantId = this.extractTenantId(request);

    // 1. Tenant allowlist check
    if (!config.uatTenantIds.includes(tenantId)) {
      await this.audit('uat_guard_check_blocked', {
        reason: 'tenant_not_allowed',
      });
      throw new ForbiddenException(
        'UAT Safety Violation: Tenant not in allowlist'
      );
    }

    // 2. Environment check
    if (config.neuronxEnv !== 'uat') {
      await this.audit('uat_guard_check_blocked', {
        reason: 'wrong_environment',
      });
      throw new ForbiddenException('UAT Safety Violation: Wrong environment');
    }

    // 3. Kill switch check
    if (!config.uatKillSwitch) {
      await this.audit('uat_guard_check_blocked', {
        reason: 'kill_switch_disabled',
      });
      throw new ForbiddenException(
        'UAT Safety Violation: Kill switch disabled'
      );
    }

    await this.audit('uat_guard_check_allowed', { mode: 'dry_run' });
    return true;
  }
}
```

#### Controller Protection

```typescript
@Controller('uat')
@UseGuards(UatGuard) // Applied to ALL UAT endpoints
export class UatController {
  // All methods protected by UAT guard
}

@Controller('uat/golden-run')
@UseGuards(UatGuard) // Additional protection for golden run
export class GoldenRunController {
  // Critical operations doubly protected
}
```

### 5. Server-Driven UI

#### UI Architecture

```
apps/operator-ui/
├── lib/api-client.ts           # Core API calls only
├── app/operator/components/
│   ├── UatBanner.tsx          # Server-driven display
│   └── OperatorConsole.tsx    # Includes UAT banner
└── NO MOCK APIs
```

#### UAT Banner Logic

```typescript
export function UatBanner() {
  // ❌ NO: if (environment === 'uat') show banner
  // ✅ YES: Call API, display what server returns

  const [uatStatus, setUatStatus] = useState(null);

  useEffect(() => {
    uatApi.getStatus().then(result => {
      if (result.success) setUatStatus(result.data);
      // Server decides if UAT is enabled
    });
  }, []);

  if (!uatStatus || uatStatus.environment !== 'uat') return null;

  return (
    <div>
      {/* Display server-provided data only */}
      <span>Mode: {uatStatus.mode}</span>
      <span>Kill Switch: {uatStatus.killSwitch ? 'ACTIVE' : 'INACTIVE'}</span>
    </div>
  );
}
```

#### Golden Run Trigger

```typescript
const runGoldenRun = async () => {
  const result = await uatApi.triggerGoldenRun(tenantId, correlationId);

  if (result.success) {
    setGoldenRunResult(result.data);
    // Display server-computed results
  } else {
    setGoldenRunResult({ success: false, error: result.error });
    // Display server-provided error
  }
};
```

### 6. Comprehensive Testing

#### Test Coverage

```typescript
describe('UAT Hardening Acceptance Tests', () => {
  describe('UI works with mocks removed', () => {
    it('returns UAT status from core API');
    it('triggers golden run through core API');
  });

  describe('Audit rows written for every step', () => {
    it('creates audit records for guard checks');
    it('creates audit records for golden run phases');
    it('creates audit records for command executions');
  });

  describe('UAT guard blocks unsafe calls', () => {
    it('blocks non-allowlisted tenants');
    it('blocks production environment');
    it('allows allowlisted tenants');
  });

  describe('Production tenants cannot execute UAT', () => {
    it('fails startup with UAT flags in prod');
    it('requires tenant ID for requests');
    it('validates correlation ID propagation');
  });
});
```

## Acceptance Criteria

### Functional Requirements

- [x] **No Mock APIs**: UI calls Core API directly via api-client
- [x] **Core API Authority**: Golden run logic resides in Core API services
- [x] **Durable Audit**: All UAT events written to audit_log table
- [x] **Hard Blocking**: UAT guard prevents all unauthorized access
- [x] **Server-Driven UI**: UI displays server responses without inference
- [x] **Correlation IDs**: All requests include and propagate correlation IDs

### Safety Requirements

- [x] **Production Protection**: UAT flags cause startup failure in production
- [x] **Tenant Isolation**: Only allowlisted tenants can access UAT
- [x] **Kill Switch**: Emergency stop prevents all external communications
- [x] **DRY_RUN Enforcement**: All UAT operations are simulations only
- [x] **Audit Completeness**: Every UAT action is durably logged

### Quality Requirements

- [x] **Test Coverage**: 100% of safety-critical paths tested
- [x] **Error Handling**: Clear error messages for all failure modes
- [x] **Performance**: < 500ms response time for UAT operations
- [x] **Documentation**: Complete specification and evidence

## Testing Strategy

### Unit Tests

- UAT guard logic validation
- Audit service persistence
- Golden run service phases
- API client core API calls

### Integration Tests

- End-to-end UAT API calls
- Database audit persistence
- UI ↔ Core API communication

### Acceptance Tests

- Safety guard enforcement
- Audit record completeness
- Production environment blocking
- UI server-driven behavior

## Risk Mitigation

### Authority Risks

- **UI Mock Bypass**: Eliminated by removing all mock APIs
- **Script Execution**: Scripts now call Core API, don't execute logic
- **Client Logic**: UI only displays server responses

### Safety Risks

- **Production Corruption**: Hard blocking prevents any UAT in production
- **Unauthorized Access**: Tenant allowlisting + guard enforcement
- **Missing Audit**: Database persistence ensures complete traceability

### Data Risks

- **Lost Events**: Database storage prevents log loss
- **Inconsistent State**: Transactional audit logging
- **Query Performance**: Indexed audit tables for fast queries

## Dependencies

### Runtime Dependencies

- `@neuronx/uat-harness` - UAT configuration and guards
- `prisma` - Database audit persistence
- `nestjs` - API framework and guards

### Development Dependencies

- `jest` - Testing framework
- `supertest` - API testing
- `@types/supertest` - TypeScript API testing

## Rollback Plan

### Immediate Rollback

1. **Restore Mock APIs**: Recreate `apps/operator-ui/app/api/uat/` routes
2. **Disable Core API**: Comment out UAT controllers in module
3. **Environment**: Set `NEURONX_ENV=prod` to disable UAT
4. **Audit**: Keep audit enhancements (beneficial)

### Code Rollback

1. **UI Changes**: Revert UatBanner to use mock APIs
2. **API Client**: Remove UAT API methods, restore direct calls
3. **Core API**: Remove golden run service/controller
4. **Audit**: Keep audit service query method (useful)

### Data Rollback

- Audit records remain (beneficial for analysis)
- No UAT test data to clean up (DRY_RUN only)

## Success Metrics

### Safety Metrics

- **Zero Production Incidents**: UAT operations impossible in production
- **100% Tenant Isolation**: No cross-tenant UAT data leakage
- **Complete Audit Coverage**: Every UAT action durably logged

### Authority Metrics

- **100% Server Authority**: No client-side UAT logic
- **Zero Mock APIs**: All calls go to Core API
- **API-Only Execution**: Scripts call APIs, don't execute logic

### Quality Metrics

- **100% Test Coverage**: All safety paths tested
- **< 500ms Response Time**: UAT operations meet performance SLA
- **Zero False Positives**: Safety guards don't block legitimate requests

## Future Enhancements

### Phase 2 Possibilities

- **Real GHL Integration**: Replace dry-run with actual API calls
- **Multi-Tenant UAT**: Support concurrent UAT environments
- **Audit Analytics**: Dashboard for UAT operation insights
- **Performance Benchmarking**: Automated performance comparisons
- **Chaos Testing**: Fault injection in UAT environment

This hardening transforms the UAT harness from "works for development" to "production-safe testing environment" with absolute authority and comprehensive safety measures.
