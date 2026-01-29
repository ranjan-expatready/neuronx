
## 2026-01-25 SHIP-TO-GA Phase 2.1 Execution
- **Deliverable 1: Test Plan for Golden Use Cases**:
  - Created `docs/ship_readiness/08_TEST_PLAN_GOLDEN_USE_CASES.md`.
  - Mapped all 10 Golden Use Cases to existing or required tests.
  - Identified 3 key gaps to close in Phase 2.1 execution:
    1. Hardening `backend-api.spec.ts` (Ingestion Payload assertions).
    2. Refactoring `journey-proof-pack.spec.ts` for LIVE_MODE (Operator Approval).
    3. Explicitly linking Work Queue creation to Routing Failure in `work-queue-scope.spec.ts`.
- **Plan Update**:
  - Updated `docs/ship_readiness/02_PLAN_BACKLOG.md` with specific Phase 2.1, 2.2, 2.3 tasks.
- **Execution Update**:
  - **Ingestion**: Hardened `backend-api.spec.ts` to include DB assertion logic (via API check) and verified idempotency.
  - **Work Queue**: Added new test case in `work-queue-scope.spec.ts` proving that High Value Qualified Opportunities automatically generate `approval_required` work items for Operators. Test **PASSED**.
  - **Operator Approval**: Refactored `journey-proof-pack.spec.ts` to support `LIVE_MODE` env var, enabling real approval actions instead of dry-runs.

## 2026-01-26 SHIP-TO-GA Phase 2.2 Execution
- **Deliverable: Admin UI MVP (Routing Policy Editor)**:
  - **Backend**:
    - Created `RoutingController` in `apps/core-api/src/sales/routing.controller.ts`.
    - Added `GET /api/v1/routing/policy` and `PUT /api/v1/routing/policy` endpoints.
    - Implemented RBAC using `PermissionsGuard` and `PERMISSIONS.ADMIN_ALL`.
    - Integrated `ConfigLoader` for persistence and `AuditService` for logging.
  - **Frontend**:
    - Created Routing Policy Editor page in `apps/operator-ui/app/routing/page.tsx`.
    - Updated `Navigation` component to show "Routing" link for admins/operators.
    - Added `routingApi` to `api-client.ts` for backend communication.
  - **Testing**:
    - Added E2E test `cypress/e2e/routing-policy.cy.ts` covering view, add, remove, and save operations.
  - **Documentation**:
    - Created `docs/product/MANUAL.md` with instructions for the new editor.
