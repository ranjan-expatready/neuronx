## PHASE 8B – Mechanical Spec Mode Enforcement via CI, Reversible

### Goal
Enforce that multi-file/security/architecture changes require a saved Spec artifact in `.factory/docs/` (or repo-approved location) and reference it in the PR. This must be mechanical (CI), not policy-only, and reversible via env toggles.

### Trigger Rules (Deterministic)
Enforce Spec artifact requirement when any of these are true in a PR:
1. **Touches >2 files** (excluding docs-only changes)
2. **Touches auth/security/rbac/secrets policies** (e.g., `src/authz/`, `src/rate-limit/`, `packages/security/`)
3. **Touches CI/governance/agent_runtime core** (e.g., `.github/workflows/`, `agent_runtime/`, `docs/SSOT/`)
4. **Touches database schema/migrations** (e.g., `prisma/`, `packages/tenancy/`)

### Passing Criteria
- A spec artifact exists in `.factory/docs/` (or configured folder) matching `YYYY-MM-DD-*.md`
- PR body includes a line like: `Spec: .factory/docs/YYYY-MM-DD-<slug>.md`
- (Optional) Spec includes acceptance criteria + verification commands

### Implementation Approach

#### New Script: `scripts/validate-spec-artifact.ts`
```typescript
#!/usr/bin/env tsx
/**
 * Spec Artifact Validation Script
 * Enforces that multi-file/security/architecture changes require a saved Spec artifact.
 * Usage: tsx scripts/validate-spec-artifact.ts
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

// Configuration (read from env)
const SPEC_DIR = process.env.SPEC_DIR || '.factory/docs';
const ENFORCE_SPEC_ARTIFACT = process.env.ENFORCE_SPEC_ARTIFACT !== 'false';
const PHASE8B_ENFORCEMENT = process.env.PHASE8B_ENFORCEMENT !== 'false';

// Get files changed in PR
function getChangedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

// Check if PR body references a spec
function getSpecReference(prBody: string): string | null {
  const match = prBody.match(/Spec:\s+(\.factory\/docs\/\d{4}-\d{2}-\d{2}-[^\s]+\.md)/i);
  return match ? match[1] : null;
}

// Check if changes require a spec
function requiresSpec(changedFiles: string[]): boolean {
  // Exclude docs-only changes
  const nonDocChanges = changedFiles.filter(f => !f.match(/\.(md|txt|mdc)$/i));
  
  // >2 files trigger
  if (nonDocChanges.length > 2) return true;
  
  // Auth/security/rbac/secrets trigger
  const securityPatterns = [
    'src/authz/', 'src/rate-limit/', 'packages/security/',
    'secrets/', 'rbac/', 'auth/', 'permission'
  ];
  if (changedFiles.some(f => securityPatterns.some(p => f.includes(p)))) return true;
  
  // CI/governance/agent_runtime trigger
  const governancePatterns = [
    '.github/workflows/', 'agent_runtime/', 'docs/SSOT/',
    'CONTRIBUTING.md', 'AGENTS.md', 'FACTORY_PLAYBOOK.md'
  ];
  if (changedFiles.some(f => governancePatterns.some(p => f.includes(p)))) return true;
  
  // Database schema/migrations trigger
  const dbPatterns = ['prisma/', 'packages/tenancy/', 'migrations/'];
  if (changedFiles.some(f => dbPatterns.some(p => f.includes(p)))) return true;
  
  return false;
}

// Main validation
function validateSpecArtifact(): boolean {
  if (!PHASE8B_ENFORCEMENT || !ENFORCE_SPEC_ARTIFACT) {
    console.log('ℹ️  Spec artifact enforcement disabled (PHASE8B_ENFORCEMENT=false or ENFORCE_SPEC_ARTIFACT=false)');
    return true;
  }
  
  const changedFiles = getChangedFiles();
  console.log(`🔍 Analyzing ${changedFiles.length} changed files...`);
  
  if (!requiresSpec(changedFiles)) {
    console.log('✅ No spec required for these changes');
    return true;
  }
  
  console.log('⚠️  Spec artifact required for these changes');
  
  // Get PR body via GitHub API
  const prBody = execSync('gh pr view --json body -q .body', { encoding: 'utf8' });
  const specRef = getSpecReference(prBody);
  
  if (!specRef) {
    console.error('❌ No spec reference found in PR body');
    console.error('Add: Spec: .factory/docs/YYYY-MM-DD-slug.md');
    return false;
  }
  
  const specPath = path.join(process.cwd(), specRef);
  if (!existsSync(specPath)) {
    console.error(`❌ Spec file not found: ${specRef}`);
    console.error('Create the spec file and update the PR body');
    return false;
  }
  
  // Optional: Check for acceptance criteria
  const specContent = readFileSync(specPath, 'utf8');
  const hasCriteria = specContent.includes('Acceptance Criteria') || specContent.includes('Verification Commands');
  if (!hasCriteria) {
    console.warn('⚠️  Spec lacks acceptance criteria or verification commands (optional but recommended)');
  }
  
  console.log(`✅ Spec artifact validated: ${specRef}`);
  return true;
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const ok = validateSpecArtifact();
  process.exit(ok ? 0 : 1);
}

export { validateSpecArtifact, requiresSpec, getSpecReference };
```

#### Update CI Workflow: `.github/workflows/pr-quality-checks.yml`
Add new step after existing evidence validation:
```yaml
- name: Validate Spec Artifact
  run: npx tsx scripts/validate-spec-artifact.ts
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    PHASE8B_ENFORCEMENT: ${{ vars.PHASE8B_ENFORCEMENT || 'true' }}
    ENFORCE_SPEC_ARTIFACT: ${{ vars.ENFORCE_SPEC_ARTIFACT || 'true' }}
```

#### Configuration Toggles
- `PHASE8B_ENFORCEMENT=false` – Disables all Phase 8B checks
- `ENFORCE_SPEC_ARTIFACT=false` – Disables only spec artifact check
- Both can be set via GitHub Actions vars or env

### Rollback Plan
If enforcement causes issues:
1. **Disable via env**: Set `PHASE8B_ENFORCEMENT=false` in GitHub vars
2. **Revert workflow**: Remove the new step from `pr-quality-checks.yml`
3. **Revert script**: Delete `scripts/validate-spec-artifact.ts`
All changes isolated to CI; no production app code affected.

### Acceptance Criteria
1. **PR with >2 files** without spec → CI fails with clear remediation
2. **PR touching security files** without spec → CI fails
3. **PR with valid spec reference** → CI passes
4. **Env toggle disabled** → CI passes regardless
5. **Rollback via env** → CI behavior returns to pre-Phase 8B

### Verification Commands
```bash
# Test locally (simulate PR)
export PHASE8B_ENFORCEMENT=true
export ENFORCE_SPEC_ARTIFACT=true
npx tsx scripts/validate-spec-artifact.ts

# Test with enforcement disabled
export PHASE8B_ENFORCEMENT=false
npx tsx scripts/validate-spec-artifact.ts  # Should pass

# Test in CI context (PR workflow)
# Push a PR with >2 files and no spec → expect failure
# Add spec and reference → expect success
```

### SSOT Updates
Update `docs/SSOT/05_CI_CD.md` and `docs/SSOT/11_GITHUB_GOVERNANCE.md` with a pointer to this spec (no duplication).

### Constraints Satisfied
- Mechanical enforcement via CI (not policy-only)
- Reversible via env toggles
- No production app code changes
- Isolated to CI scripts and workflows