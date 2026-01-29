# Test Strategy

## 1. The Testing Pyramid
We follow a standard pyramid distribution to ensure fast feedback and high confidence.

| Layer | Type | Scope | Target Mix | Key Characteristics |
|-------|------|-------|------------|---------------------|
| **L3** | **E2E / Functional** | Full Stack | ~10% | Runs against real running app (HTTP + DB). Black box. **Critical Paths Only**. |
| **L2** | **Integration** | Module / Service | ~20% | "Real Chain" testing. Real internal services wired together. Mocks only at I/O boundaries (DB*, External APIs). |
| **L1** | **Unit** | Function / Class | ~70% | Isolated logic. Fast. 100% mocked dependencies. |

*> Note on DB in Integration: We prefer using an in-memory DB or Dockerized DB for Integration tests if possible, but mocking the Repository/Prisma layer is acceptable for L2 if L3 covers the actual persistence.*

## 2. Integration Testing Policy ("The Real Chain")
To avoid "Mocking the Mock" and false positives:
1.  **Do NOT mock internal services** in Integration tests.
    *   *Bad*: Mocking `LeadScorerService` when testing `SalesService`.
    *   *Good*: Instantiating real `LeadScorerService` and injecting it into `SalesService`.
2.  **Mock External Boundaries Only**:
    *   Database (Prisma) -> Mock or TestContainer.
    *   Message Bus (EventBridge/SNS) -> Mock `EventBus` but assert calls.
    *   3rd Party APIs (GHL, Twilio) -> Mock HTTP Client or Adapter.
3.  **Why?** This ensures that if the *contract* between Internal Service A and Internal Service B changes, the test fails (correctly).

## 3. Flake Control & Determinism
1.  **No Retries**: Tests must pass on the first try. Flaky tests are quarantined immediately.
2.  **Deterministic Data**:
    *   Do not use `Math.random()` or dynamic dates without freezing time.
    *   Use explicit IDs (e.g., `lead-123` not `uuid()`) in assertions.
3.  **Cleanup**:
    *   E2E tests must clean up their data or run in a transaction that rolls back.
    *   Use unique Tenant IDs per test run to ensure isolation.

## 4. E2E Constraints (The "Small Cap")
To prevent the E2E suite from becoming a 1-hour bottleneck:
*   **Max 3-5 Critical Flows** initially.
*   **Time Budget**: Must run in < 5 minutes in CI.
*   **Scope**:
    1.  **Lead Ingestion Flow**: Webhook -> DB -> Routing Side Effect.
    2.  **Security Gates**: Signature verification, Authz.
    3.  **Health/Smoke**: System starts and connects to deps.

## 5. Tooling
*   **Unit/Integration**: Vitest (fast, watch mode).
*   **E2E**: Playwright (reliable, traces).
*   **CI**: GitHub Actions.
