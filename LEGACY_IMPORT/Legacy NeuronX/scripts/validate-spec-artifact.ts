#!/usr/bin/env tsx
/**
 * Spec Artifact Validation Script
 * Enforces that multi-file/security/architecture changes require a saved Spec artifact.
 * Usage: npx tsx scripts/validate-spec-artifact.ts
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
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
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                    require.main?.filename === __filename;

if (isMainModule) {
  const ok = validateSpecArtifact();
  process.exit(ok ? 0 : 1);
}

export { validateSpecArtifact, requiresSpec, getSpecReference };
