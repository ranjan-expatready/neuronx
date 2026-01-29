# Repo Audit Report

## Inventory

### Structure
-   **Monorepo Tool**: pnpm workspaces
-   **Apps**:
    -   `core-api` (NestJS): Main backend service.
    -   `control-plane-api` (NestJS): Management API.
    -   `operator-ui` (Next.js): Internal tool for operators.
    -   `executive-ui` (Next.js): Dashboard for executives.
    -   `manager-ui` (Next.js): Dashboard for managers.
    -   `customer-trust-portal` (Next.js): Public/customer facing.
-   **Packages**: Extensive shared logic in `packages/` including `decision-engine`, `voice-orchestration`, `adapters`, `domain`, etc.

### Dependencies
-   **Node Version**: `22` (Found v23 in environment, warning issued).
-   **Key Libraries**:
    -   Backend: NestJS, Prisma, Fastify.
    -   Frontend: Next.js, React, TailwindCSS.
    -   Testing: Vitest, Jest, Playwright.
-   **Issues**:
    -   `@nestjs/testing` is v11 but core packages are v10. Peer dependency warnings.
    -   Deprecated packages: `inflight`, `rimraf`, `glob`.

### Configuration
-   **Env Vars**: `env-example.txt` exists in root. Needs to be standardized to `.env.example`.
-   **Build**: `pnpm build` triggers nested builds.
-   **Linting**: ESLint with Prettier.
-   **Testing**: Mixed usage of Jest (integration) and Vitest (unit).

## Baseline Checks

### Installation
-   `pnpm install`: **SUCCESS** (with warnings).

### Testing Status
-   **Result**: ❌ **FAILED** (70 failed, 168 passed)
-   **Key Failures**:
    -   `PrismaClient` not initialized (needs `prisma generate`).
    -   `ReferenceError: jest is not defined` in `sla.service.spec.ts` (Vitest vs Jest conflict).
    -   `Invalid Chai property: toEndWith` in `storage-keys.spec.ts` (Vitest matchers issue).
    -   Logic failures in `routing.config.spec.ts`.

### Linting Status
-   **Result**: ❌ **FAILED** (2986 problems)
-   **Key Issues**:
    -   `no-undef`: `describe`, `it`, `expect` not recognized (ESLint config issue).
    -   `@typescript-eslint/no-unsafe-*`: Strict type checking failing on many files.

## Top Risks
1.  **Test Framework Conflict**: The codebase mixes Jest and Vitest patterns, causing runtime failures in tests (e.g., `jest` global not found in Vitest runs).
2.  **Database State**: Tests requiring Prisma are failing because the client isn't generated.
3.  **Linting Noise**: The sheer volume of lint errors makes the linter useless as a gate until fixed or suppressed.
4.  **Dependency Mismatch**: NestJS version conflict could cause runtime or testing errors.
