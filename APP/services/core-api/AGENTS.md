# Core API Scoped Operating Rules

**Canonical Reference** | **Scoped for apps/core-api work** | **Evidence-Based Development**

Refer to canonical sources for full governance:
- [`../../AGENTS.md`](../../AGENTS.md) – Root agent governance  
- [`docs/SSOT/index.md`](../../docs/SSOT/index.md) – Single Source of Truth
- [`docs/SSOT/04_TEST_STRATEGY.md`](../../docs/SSOT/04_TEST_STRATEGY.md) – Testing strategy

## Scope Boundary
- **Applies to**: All agent work inside `apps/core-api/` directory
- **Includes**: NestJS API, business logic, adapters, database layer
- **Excludes**: Vendor/platform workflows (no business logic in external systems)

## Exact Commands (Copy/Paste)

### Type Checking & Linting
```bash
pnpm -w typecheck
pnpm -w lint
```

### Unit Tests
```bash
pnpm --filter @neuronx/core-api test
pnpm -w test:unit
```

### Coverage & Debug
```bash
pnpm --filter @neuronx/core-api test:cov
```

### Build & Development
```bash
pnpm --filter @neuronx/core-api build
pnpm --filter @neuronx/core-api start:dev
```

## Essential Rules (8 bullets)
1. NeuronX owns all business logic – adapters contain only protocol translation
2. Never embed business logic in external platform workflows  
3. All external integrations must go through adapter layer
4. Database access through Prisma client with tenant isolation
5. Run typecheck and lint before any change
6. Follow TDD for bug/logic changes (see below)
7. Maintain vendor boundary (no drift)
8. Capture evidence in `docs/EVIDENCE/`

## Test-Driven Development (TDD) Policy
- **Add/modify a failing test first** – prove the defect or missing behavior
- **Run tests** – confirm failure, then fix implementation
- **Rerun all relevant tests** – ensure no regression

---

**Navigation**: See root AGENTS.md for complete governance.
