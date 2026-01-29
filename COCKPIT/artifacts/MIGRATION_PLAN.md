# Migration Plan: Legacy to APP

**Date**: 2026-01-29
**Status**: APPROVED (Pending PRs)

## Target Structure (`APP/`)

We will adopt a `services/`, `web/`, and `libs/` structure within `APP/` to clean up the root `apps/` and `packages/` usage.

```
APP/
├── services/
│   ├── core-api/          (from apps/core-api)
│   ├── control-plane-api/ (from apps/control-plane-api)
│   ├── adapters/          (from apps/adapters)
│   └── ollama-gateway/    (from main.py + new structure)
├── web/
│   ├── customer-trust-portal/ (from apps/customer-trust-portal)
│   ├── executive-ui/          (from apps/executive-ui)
│   ├── manager-ui/            (from apps/manager-ui)
│   └── operator-ui/           (from apps/operator-ui)
└── libs/
    └── [packages/*]       (from packages/*)
```

## Migration Strategy (Incremental PRs)

### PR 1: Skeleton & Configuration
- **Objective**: Establish the workspace structure without code.
- **Changes**:
    - Create `APP/services`, `APP/web`, `APP/libs`.
    - Create/Update `pnpm-workspace.yaml` at Repo Root to point to `APP/**/*`.
    - Copy root `package.json` to Repo Root (consolidating dependencies).
    - Setup `APP/services/ollama-gateway/` structure (empty).

### PR 2: Libraries Migration
- **Objective**: Move shared libraries first.
- **Changes**:
    - Move `LEGACY_IMPORT/Legacy NeuronX/packages/*` to `APP/libs/*`.
    - Update references if necessary (search/replace).

### PR 3: Python Gateway Service
- **Objective**: Establish the AI Gateway.
- **Changes**:
    - Move `main.py` to `APP/services/ollama-gateway/main.py`.
    - Create `APP/services/ollama-gateway/requirements.txt`.
    - Create Dockerfile or build script for it.

### PR 4: Core Services
- **Objective**: Move backend services.
- **Changes**:
    - Move `apps/core-api` to `APP/services/core-api`.
    - Move `apps/control-plane-api` to `APP/services/control-plane-api`.

### PR 5: UI Applications
- **Objective**: Move frontends.
- **Changes**:
    - Move `apps/*-ui` to `APP/web/*-ui`.

## Verification Strategy
- **Structure**: Verify file locations match map.
- **Build**: Run `pnpm install` and `pnpm build` after each move.
- **Test**: Run `vitest` and `jest` to ensure tests still pass.

## Rollback Plan
- Revert PR.
- Legacy code remains untouched in `LEGACY_IMPORT/`.
