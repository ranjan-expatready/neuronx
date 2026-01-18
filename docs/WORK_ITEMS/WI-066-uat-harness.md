# WI-066: UAT Harness + Seed + Safety

## Objective

Implement a complete UAT (User Acceptance Testing) environment that enables "touch & feel" end-to-end testing of NeuronX with production-like data WITHOUT risking production systems or corrupting real GHL accounts.

## Scope

### In Scope

- UAT environment configuration with fail-closed safety
- Tenant isolation and allowlisting
- Adapter execution modes (DRY_RUN vs LIVE_UAT)
- Deterministic data seeding for NeuronX database
- Optional GHL sub-account seeding for LIVE_UAT
- End-to-end "Golden Run" verification script
- Operator UI UAT banner and controls
- Safety guards preventing production corruption
- Comprehensive audit trails and monitoring

### Out of Scope

- Production deployment changes
- Real GHL API integration (mocked for safety)
- Multi-region UAT environments
- Automated CI/CD integration
- Performance benchmarking

## Implementation Details

### A) CONFIG + ENV

#### Environment Variables

```bash
# Core environment identification
NEURONX_ENV=dev|uat|prod  # default: dev

# UAT tenant isolation
UAT_TENANT_IDS=tenant1,tenant2,tenant3

# UAT execution mode
UAT_MODE=dry_run|live_uat  # default: dry_run

# Kill switch - when true, blocks all adapter side-effects
UAT_KILL_SWITCH=true|false  # default: true in uat

# GHL-specific UAT isolation
UAT_GHL_LOCATION_IDS=loc1,loc2,loc3

# UAT label prefix for created records
UAT_LABEL_PREFIX="[UAT]"  # default: "[UAT]"

# Provider-specific allowlists for LIVE_UAT mode
UAT_TEST_PHONE_ALLOWLIST=+1234567890,+0987654321
UAT_EMAIL_DOMAIN_ALLOWLIST=test.com,example.com
UAT_CALENDAR_ALLOWLIST=cal1,cal2
```

#### Fail-Closed Behavior

- **Production**: Any UAT flags cause startup failure
- **UAT**: Only allowlisted tenants; kill switch defaults to true
- **Development**: Allows all operations with dry_run mode

### B) BACKEND GUARDRAILS (core-api)

#### UAT Guard Middleware

- **Location**: `apps/core-api/src/uat/uat.guard.ts`
- **Purpose**: Guards all execution paths with UAT safety checks
- **Integration**: Applied via `@UseGuards(UatGuard)` on controllers

#### Guard Rules

```typescript
// Production environment - never allow UAT
if (config.neuronxEnv === 'prod') {
  return BLOCK('PRODUCTION SAFETY: UAT operations not allowed');
}

// UAT environment - tenant isolation required
if (config.neuronxEnv === 'uat' && !tenantAllowlisted) {
  return BLOCK('UAT ISOLATION: Tenant not in allowlist');
}

// Kill switch active - force DRY_RUN
if (config.uatKillSwitch) {
  return ALLOW_DRY_RUN();
}
```

#### UAT Service

- **Location**: `apps/core-api/src/uat/uat.service.ts`
- **Endpoints**:
  - `GET /uat/status` - Current UAT environment status
  - `GET /uat/readiness` - UAT readiness validation
  - `POST /uat/golden-run` - Trigger golden run execution

### C) ADAPTER EXECUTION MODES

#### Extended Execution Framework

- **Location**: `packages/execution-framework/src/`
- **New Types**: `UatExecutionMode`, `UatContext`

#### Execution Modes

```typescript
enum UatExecutionMode {
  DRY_RUN = 'dry_run', // No external calls, deterministic simulation
  LIVE_UAT = 'live_uat', // External calls with allowlist validation
}
```

#### Orchestrator Changes

- **Location**: `packages/execution-framework/src/orchestrator/execution-orchestrator.service.ts`
- **New Methods**:
  - `validateUatExecutionMode()` - Checks UAT safety before execution
  - `executeWithUatMode()` - Handles DRY_RUN vs LIVE_UAT execution
  - `checkProviderAllowlist()` - Validates provider-specific allowlists

#### DRY_RUN Mode Behavior

- No external API calls made
- Returns deterministic simulated results
- Emits `UAT_DRY_RUN_EXECUTED` audit events
- External ID format: `uat_dry_run_{commandId}_{adapterName}`

#### LIVE_UAT Mode Behavior

- Checks provider-specific allowlists before execution
- Blocks execution if allowlists empty or value not allowed
- Emits `UAT_LIVE_EXECUTION_BLOCKED` on violations
- Emits `UAT_BOUNDARY_VIOLATION` on safety violations

#### Provider-Specific Validation

```typescript
// SMS: Phone number allowlist
if (!config.uatTestPhoneAllowlist.includes(phoneNumber)) {
  BLOCK('SMS not in test allowlist');
}

// Email: Domain allowlist
const domain = email.split('@')[1];
if (!config.uatEmailDomainAllowlist.includes(domain)) {
  BLOCK('Email domain not in test allowlist');
}

// GHL: Location ID allowlist
if (!config.uatGhlLocationIds.includes(locationId)) {
  BLOCK('GHL location not in test allowlist');
}
```

### D) UAT SEEDING

#### NeuronX Seeding Script

- **Location**: `scripts/uat/seed-neuronx.ts`
- **Purpose**: Creates production-like test data in NeuronX DB
- **Idempotent**: Safe to re-run, uses deterministic IDs

##### Seeded Data Structure

```typescript
// Enterprise + Agency + Teams + Members
enterprise: "[UAT] Acme Corporation"
agency: "Sales Operations"
teams: ["Enterprise Sales", "Mid-Market Sales", "SMB Sales", "Channel Partners"]
members: ["Sarah Johnson (ENTERPRISE_ADMIN)", "Mike Chen (TEAM_LEAD)", ...]

// Contacts (8 realistic contacts)
contacts: [
  { name: "John Smith", company: "TechCorp Inc", email: "...@techcorp.com" },
  { name: "Emily Davis", company: "Global Solutions", email: "...@globalsolutions.com" },
  // ... 6 more contacts
]

// Opportunities (8 opportunities across all FSM states)
opportunities: [
  { title: "TechCorp Website Redesign", value: 75000, state: "NEW" },
  { title: "Global Solutions CRM Implementation", value: 125000, state: "QUALIFIED" },
  { title: "Innovate Ltd Mobile App", value: 95000, state: "CONTACT_ATTEMPTING" },
  // ... 5 more opportunities with SLA at-risk examples
]

// Decision Explanations (for qualified opportunities)
explanations: [
  {
    opportunityId: "...",
    decisionType: "qualification_decision",
    confidence: 0.85,
    reasoning: "Strong fit based on company profile and requirements"
  }
]
```

##### Usage

```bash
# Seed NeuronX data
pnpm ts-node scripts/uat/seed-neuronx.ts --tenant-id uat-tenant-001

# Dry run
pnpm ts-node scripts/uat/seed-neuronx.ts --tenant-id uat-tenant-001 --dry-run

# Force override existing data
pnpm ts-node scripts/uat/seed-neuronx.ts --tenant-id uat-tenant-001 --force
```

#### GHL Seeding Script

- **Location**: `scripts/uat/seed-ghl.ts`
- **Purpose**: Creates test data in UAT GHL accounts
- **Safety**: ONLY runs when LIVE_UAT enabled and location allowlisted
- **Status**: Mock implementation (real GHL API integration pending)

##### Seeded GHL Data

```typescript
// Contacts
contacts: [
  { name: '[UAT] John Smith', email: 'john.smith.uat@techcorp.com' },
  { name: '[UAT] Emily Davis', email: 'emily.davis.uat@globalsolutions.com' },
  // ... 3 more contacts
];

// Opportunities
opportunities: [
  { title: '[UAT] TechCorp Website Redesign', value: 75000 },
  { title: '[UAT] Global Solutions CRM Implementation', value: 125000 },
];

// Tasks
tasks: [
  { title: '[UAT] Follow up with TechCorp', dueDate: 'tomorrow' },
  { title: '[UAT] Schedule demo for Global Solutions', dueDate: 'day after' },
];
```

### E) "GOLDEN RUN" END-TO-END SCRIPT

#### Golden Run Script

- **Location**: `scripts/uat/golden-run.ts`
- **Purpose**: Exercises complete NeuronX workflow end-to-end
- **Phases**: environment → readiness → work queue → explain → plan → approve → execute → audit

#### Golden Run Flow

```bash
# 1. Environment & Safety Validation
✓ UAT environment confirmed
✓ Tenant allowlisted
✓ Kill switch status verified

# 2. System Readiness Check
✓ Core services responding
✓ Database connectivity verified
✓ No blocking issues detected

# 3. Work Queue Access
✓ 8 opportunities found
✓ Selected: "[UAT] TechCorp Website Redesign"

# 4. Decision Explanation
✓ Qualification decision: QUALIFIED
✓ Confidence: 85%

# 5. Execution Planning
✓ Plan generated: plan_uat_001
✓ 3 commands created (email, call, task)

# 6. Approval Workflow
✓ Approval granted: approval_uat_001

# 7. Command Execution
✓ 3/3 commands executed successfully
✓ DRY_RUN mode: all simulated

# 8. Audit Trail Verification
✓ 8 events recorded
✓ Full chain traceable
```

#### Usage

```bash
# DRY_RUN mode (default, safe)
pnpm ts-node scripts/uat/golden-run.ts --tenant-id uat-tenant-001

# LIVE_UAT mode (requires kill switch disabled)
pnpm ts-node scripts/uat/golden-run.ts --tenant-id uat-tenant-001 --live

# Skip approval step
pnpm ts-node scripts/uat/golden-run.ts --tenant-id uat-tenant-001 --skip-approval
```

### F) UI "TOUCH & FEEL" HOOKS

#### UAT Banner Component

- **Location**: `apps/operator-ui/app/operator/components/UatBanner.tsx`
- **Purpose**: Displays UAT environment status and controls
- **Visibility**: Only shown in UAT environment

##### Banner Features

```typescript
// Environment status display
🧪 UAT ENVIRONMENT
Mode: DRY_RUN | LIVE_UAT
Kill Switch: ACTIVE | DISABLED

// Tenant & correlation tracking
Tenant: uat-tenant-001
Correlation: op_console_1640995200000

// Golden run button
🏆 Run Golden Run (triggers backend golden run)

// Expandable details
Environment Status:
- Environment: uat
- Mode: dry_run
- Kill Switch: true
- Allowed Tenants: 2
- Provider Allowlists: SMS (2), Email (2), Calendar (1), GHL (1)

// Golden run results
✅ Success (1250ms)
Phases: readiness ✓, workQueue ✓, explain ✓, plan ✓, approve ✓, execute ✓, audit ✓
```

#### API Integration

- **Status Endpoint**: `/api/uat/status` - Returns current UAT configuration
- **Golden Run Endpoint**: `/api/uat/golden-run` - Triggers golden run execution
- **Integration**: Banner polls status and displays results

### G) TESTS + EVIDENCE

#### Unit Tests

- **Location**: `packages/uat-harness/src/__tests__/`
- **Coverage**:
  - UAT configuration loading and validation
  - UAT guard service safety checks
  - Provider allowlist validation
  - Fail-closed behavior verification

#### Integration Tests

- **Location**: `apps/core-api/src/uat/__tests__/`
- **Coverage**:
  - UAT guard middleware behavior
  - Execution orchestrator UAT modes
  - End-to-end golden run simulation

#### Test Fixtures

- **Location**: `tests/fixtures/uat/`
- **Content**: Predefined UAT test scenarios and expected outcomes

## Acceptance Criteria

### Functional Requirements

- [x] UAT environment configuration loads from environment variables
- [x] Production environment blocks all UAT operations
- [x] UAT environment enforces tenant allowlisting
- [x] Kill switch defaults to active in UAT environment
- [x] DRY_RUN mode produces deterministic simulated results
- [x] LIVE_UAT mode validates provider-specific allowlists
- [x] NeuronX seeding creates realistic test data structure
- [x] GHL seeding validates safety before external API calls
- [x] Golden run exercises complete explain→plan→approve→execute flow
- [x] Operator UI shows UAT banner with status and controls
- [x] All operations are fully auditable with correlation IDs

### Quality Requirements

- [x] No external side-effects occur in DRY_RUN mode
- [x] All seeding scripts are idempotent and safe to re-run
- [x] Fail-closed behavior prevents production corruption
- [x] Provider allowlists prevent unauthorized external communications
- [x] Audit trails capture complete execution chains
- [x] Error messages are clear and actionable

### Safety Requirements

- [x] Production startup fails if any UAT flags are enabled
- [x] UAT operations are strictly isolated by tenant allowlists
- [x] Kill switch provides emergency stop capability
- [x] GHL seeding only permitted with explicit LIVE_UAT configuration
- [x] All created records are clearly labeled as UAT test data

## Testing Strategy

### Unit Testing

```bash
# Run UAT harness tests
cd packages/uat-harness
npm test

# Coverage requirements
- Configuration validation: 100%
- Guard service logic: 100%
- Provider allowlists: 100%
- Safety boundary checks: 100%
```

### Integration Testing

```bash
# Test UAT guard middleware
npm run test:integration uat-guard

# Test execution orchestrator UAT modes
npm run test:integration uat-execution

# Test golden run end-to-end
npm run test:integration golden-run
```

### Manual Testing

```bash
# 1. Environment safety validation
NEURONX_ENV=prod UAT_TENANT_IDS=any
# → Should fail startup

# 2. UAT tenant isolation
NEURONX_ENV=uat UAT_TENANT_IDS=allowed-tenant
# → Only allowed-tenant can access UAT operations

# 3. DRY_RUN verification
UAT_MODE=dry_run
# → No external API calls, deterministic results

# 4. Golden run execution
pnpm ts-node scripts/uat/golden-run.ts --tenant-id uat-tenant-001
# → Complete end-to-end flow with audit trail
```

## Risk Mitigation

### Production Safety

- **Fail-Closed Design**: Any configuration ambiguity blocks operations
- **Startup Validation**: Invalid UAT config prevents service startup
- **Environment Isolation**: Production environment cannot enable UAT features
- **Audit Requirements**: All UAT operations must be fully traceable

### Data Corruption Prevention

- **Tenant Isolation**: UAT data strictly separated by tenant boundaries
- **Labeling Requirements**: All UAT records clearly marked as test data
- **Idempotent Operations**: Seeding scripts safe to re-run without duplication
- **Rollback Capability**: Clear procedures for cleaning UAT test data

### External System Protection

- **Allowlist Enforcement**: Only approved test resources can be contacted
- **Kill Switch**: Emergency stop for all external communications
- **Dry Run Default**: Safe simulation mode enabled by default
- **Provider Validation**: Each provider type has specific safety checks

## Dependencies

### Runtime Dependencies

- `@neuronx/uat-harness` - UAT configuration and guard services
- `zod` - Runtime configuration validation
- `prisma` - Database operations for seeding

### Development Dependencies

- `typescript` - Type safety
- `jest` - Unit testing framework
- `ts-jest` - TypeScript test support

## Rollback Plan

### Immediate Rollback

1. **Environment Variables**: Remove all `UAT_*` environment variables
2. **Configuration**: Revert to `NEURONX_ENV=prod` for production
3. **Service Restart**: Restart all services to pick up new configuration
4. **Data Cleanup**: Remove UAT-labeled test data if needed

### Code Rollback

1. **UAT Module**: Remove `UatModule` from `app.module.ts`
2. **UI Components**: Remove `UatBanner` from `OperatorConsole.tsx`
3. **Execution Framework**: Revert orchestrator to pre-UAT version
4. **Scripts**: Remove `scripts/uat/` directory
5. **Package**: Remove `@neuronx/uat-harness` package

### Data Rollback

```sql
-- Remove UAT test data
DELETE FROM opportunities WHERE title LIKE '[UAT]%';
DELETE FROM contacts WHERE name LIKE '[UAT]%';
DELETE FROM decision_explanations WHERE tenant_id IN ('uat-tenant-001', ...);
-- Additional cleanup as needed
```

## Success Metrics

### Safety Metrics

- **Zero Production Incidents**: No UAT operations affect production systems
- **100% Tenant Isolation**: UAT data never leaks between tenants
- **Audit Completeness**: 100% of UAT operations fully traceable

### Functionality Metrics

- **Golden Run Success Rate**: 100% success in DRY_RUN mode
- **Seeding Reliability**: 100% idempotent, zero data corruption
- **UI Responsiveness**: UAT banner loads within 500ms

### Developer Experience Metrics

- **Setup Time**: UAT environment ready within 5 minutes
- **Test Data Quality**: 100% realistic, production-like test scenarios
- **Debugging Capability**: Full audit trails for all operations

## Future Enhancements

### Phase 2 Possibilities

- **Real GHL Integration**: Replace mock GHL client with actual API calls
- **Multi-Tenant UAT**: Support multiple simultaneous UAT environments
- **Performance Benchmarking**: Automated performance comparisons
- **Automated Test Suites**: CI/CD integration for regression testing
- **Advanced Monitoring**: Real-time UAT environment health dashboards

### Integration Opportunities

- **CI/CD Pipeline**: Automated UAT environment provisioning
- **Load Testing**: Performance validation with realistic data volumes
- **Chaos Engineering**: Fault injection testing in UAT environment
- **Blue-Green Deployment**: UAT environment as canary deployment target
