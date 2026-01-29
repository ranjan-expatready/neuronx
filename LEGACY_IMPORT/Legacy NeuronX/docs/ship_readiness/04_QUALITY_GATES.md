# Quality Gates

## Merge Readiness (PR Gates)
Every Pull Request must pass the following checks before merging:

1.  **CI Pass**: The `Ship Readiness Gate` workflow must pass on GitHub Actions.
2.  **Linting**: `pnpm run lint` must pass with 0 errors.
3.  **Static Analysis**: `lint` and `typecheck` are **Ratcheted**.
    *   They must not exceed the baseline counts in `docs/ship_readiness/quality-baseline.json`.
    *   **Ratchet Rule**: The baseline can only go DOWN. Increases are blocked.
    *   **Governance**: To modify the baseline (e.g. to lock in improvements), you must run checks with `ALLOW_BASELINE_UPDATE=1`.
    *   Current Baseline: ~2515 Lint Issues, ~217 Type Errors.
    *   Goal: Gradually reduce to 0.
4.  **Build Verification**: `pnpm build` runs in **Permissive Mode** (Warn-Only).
    *   Currently blocked by legacy type errors.
    *   Will be made strict once Type Errors < 0.
5.  **Unit Tests**: `pnpm run test:unit` must pass (currently targeting core services).
6.  **Security**: No critical vulnerabilities in dependencies (`pnpm audit`).
7.  **Node Version**: Must use the version pinned in `.nvmrc` (currently Node 22).

## Test Quarantine Policy
Tests that are flaky or broken due to known technical debt may be quarantined to keep the main pipeline green.

### Rules (The Ratchet)
1.  **No Growth**: The number of quarantined items cannot exceed the baseline count defined in `docs/ship_readiness/quarantine-baseline.json`.
    *   To add a new item, you must first fix an existing one (swap) or explicitly update the baseline (requires justification).
2.  **Metadata Enforcement**: All entries in `docs/ship_readiness/QUARANTINE_LIST.md` must include:
    *   `Target`: The file or suite path.
    *   `Category`: Type of test (e.g., Unit, E2E, Integration).
    *   `Reason`: Why it is quarantined.
    *   `Tracking ID`: Backlog item (e.g., ticket number).
    *   `Owner`: Team or individual responsible.

### Process
1.  **Quarantine**:
    *   Add the test to `docs/ship_readiness/QUARANTINE_LIST.md` with all metadata.
    *   Ensure total count <= baseline.
    *   Exclude the test from `./scripts/verify-readiness.sh`.
2.  **Resolution**:
    *   Fix the test.
    *   Remove from `QUARANTINE_LIST.md`.
    *   Re-enable in verification script.
    *   (Optional) Update baseline to lock in the improvement.

## Release Readiness
Before cutting a release (tagging):

1.  **All PR Gates Pass**.
2.  **Smoke Test**: The application starts successfully in a clean environment.
3.  **Database**: Migrations apply successfully.
4.  **Documentation**: CHANGELOG is updated.

## Verification Script
Run `scripts/verify-readiness.sh` to validate the current state of the repository against these gates.
