# Legacy Audit Report

**Date**: 2026-01-29
**Auditor**: Antigravity

## 1. System Overview
The legacy codebase (`sales-os`) is a **Hybrid Monorepo** containing:
- **NodeJS/TypeScript Microservices & Frontends** (managed via `pnpm` workspaces).
- **Python Service** (`main.py`) serving as an Ollama Gateway.

## 2. Inventory

### Applications (`apps/`)
- `core-api`: Primary backend (NodeJS/NestJS likely).
- `control-plane-api`: Infrastructure/Management API.
- `adapters`: (e.g., `adapters-ghl-webhook`).
- `customer-trust-portal`: Frontend Application.
- `executive-ui`: Frontend Application.
- `manager-ui`: Frontend Application.
- `operator-ui`: Frontend Application.

### Python Components
- `main.py`: Standalone FastAPI service ("Ollama Gateway").
- Uses `poetry` or `pip` (only `requirements.txt` found).

### Frameworks & Tools
- **Build System**: pnpm workspaces.
- **Languages**: TypeScript (v5.0), Python (3.x).
- **Testing**:
    - **Unit**: Vitest.
    - **Integration**: Jest.
    - **E2E**: Playwright, Cypress.
- **Linting**: ESLint, Prettier.

## 3. Risk Assessment

### Security Risks
- **Hardcoded Defaults**: `main.py` contains `PROXY_API_KEY` default value.
- **Environment Handling**: `python-dotenv` and Node `.env` usage needs consolidation.
- **Secret Scan**: Automatic scan pending on `apps/` configuration files.

### Migration Conflicts
- **Structure**: Legacy uses `apps/` and `packages/` root structure. OS `APP/` structure is flat or modular. We need to map `apps/*` to `APP/*` clearly.
- **Hybrid Build**: OS CI pipeline needs to support both Node and Python lint/test steps concurrently or separated.

### Technical Debt
- `main.py` is a single file script that should be a proper service module.
- "Private: true" in root package.json suggests internal-only.

## 4. Migration Recommendations

### 1. Python Migration
- Move `main.py` to `APP/services/ollama-gateway/`.
- Create proper `pyproject.toml` or `requirements.txt` in that directory.

### 2. Node.js Migration
- Move `apps/core-api` -> `APP/services/core-api`.
- Move `apps/*-ui` -> `APP/web/*-ui`.
- Move `packages/*` -> `APP/libs/*` or `APP/packages/*`.

### 3. CI/CD
- Update `governance-validator` to scan TS and Python files.
- Configuration for `pnpm` workspaces at `APP/` root or repo root.

## 5. Quick Wins
- Standardize `README.md` for each component.
- Consolidate Python service into a proper structure.
