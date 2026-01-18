#!/usr/bin/env node
/**
 * Spec Artifact Validation Script
 * Enforces that multi-file/security/architecture changes require a saved Spec artifact.
 * 
 * Usage: node scripts/validate-spec-artifact.js
 * 
 * Environment Variables:
 * - ENFORCE_SPEC_ARTIFACT: Set to 'false' to disable enforcement (default: 'true')
 * - SPEC_DIR: Directory containing spec artifacts (default: '.factory/docs')
 */

const { execSync } = require('child_process');
const { existsSync, readdirSync, readFileSync } = require('fs');
const path = require('path');

// Configuration (read from env)
const SPEC_DIR = process.env.SPEC_DIR || '.factory/docs';
const ENFORCE_SPEC_ARTIFACT = process.env.ENFORCE_SPEC_ARTIFACT !== 'false';

// Get files changed in PR
function getChangedFiles() {
  try {
    // Try multiple git diff strategies to handle different CI environments
    const strategies = [
      () => execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' }),
      () => execSync('git diff --name-only main...HEAD', { encoding: 'utf8' }),
      () => execSync('git diff --name-only HEAD~1', { encoding: 'utf8' }),
      () => execSync('git diff --name-only HEAD^', { encoding: 'utf8' })
    ];

    for (const strategy of strategies) {
      try {
        const output = strategy();
        return output.trim().split('\n').filter(Boolean);
      } catch (e) {
        continue; // Try next strategy
      }
    }
    
    console.warn('⚠️  Could not determine changed files with any strategy');
    return [];
  } catch (e) {
    console.warn('⚠️  Error getting changed files:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Get PR body via GitHub CLI
async function getPRBody() {
  try {
    const body = execSync('gh pr view --json body -q .body 2>/dev/null', { encoding: 'utf8' });
    return body.trim();
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    
    // Check for common fork/permission issues
    if (errorMsg.includes('GH_TOKEN') || errorMsg.includes('not found') || errorMsg.includes('authentication')) {
      console.error('❌ Spec gate requires PR body access');
      console.error('⚠️  GitHub token cannot read PR body (common on forks)');
      console.error('');
      console.error('Remediation options:');
      console.error('  (a) Manually include spec path in PR body:');
      console.error('      Spec: .factory/docs/YYYY-MM-DD-descriptive-slug.md');
      console.error('');
      console.error('  (b) Disable enforcement for fork workflows:');
      console.error('      Set ENFORCE_SPEC_ARTIFACT=false in repo Settings > Variables');
      console.error('');
      console.error('  (c) Run from same-repo branch (recommended for production)');
      console.error('');
      console.error('Error details:', errorMsg.substring(0, 100));
      process.exit(1);
    }
    
    // Fallback to reading from file if available
    try {
      const prBodyPath = process.env.GITHUB_PR_BODY_FILE || './pr_body.txt';
      if (existsSync(prBodyPath)) {
        return readFileSync(prBodyPath, 'utf8');
      }
    } catch (fileError) {
      // Ignore file read error
    }
    
    console.warn('⚠️  Could not retrieve PR body (gh CLI not available or PR body file not found)');
    return '';
  }
}

// Check if PR body references a spec
function getSpecReference(prBody) {
  const match = prBody.match(/Spec:\s+(\.factory\/docs\/\d{4}-\d{2}-\d{2}-[^\s]+\.md)/i);
  return match ? match[1] : null;
}

// Check if PR body declares spec not applicable
function getSpecNotApplicable(prBody) {
  // Look for "Spec N/A:" followed by a reason
  const match = prBody.match(/Spec\s+N\/A:\s*(.+?)(\n|$)/i);
  return match ? match[1].trim() : null;
}

// Check if changes require a spec
function requiresSpec(changedFiles) {
  // Exclude documentation-only changes from count
  const nonDocChanges = changedFiles.filter(f => !f.match(/\.(md|txt|mdc)$/i));
  
  // >2 files trigger (excluding docs)
  if (nonDocChanges.length >= 3) {
    console.log(`🎯 ${nonDocChanges.length} non-doc files changed (threshold: 3)`);
    return true;
  }
  
  // Check for sensitive paths that always require spec
  const sensitivePatterns = [
    // Security/Auth related
    'src/authz/', 
    'src/rate-limit/', 
    'packages/security/',
    'security/',
    'auth/',
    'rbac/',
    'permission',
    // Agent runtime core
    'agent_runtime/agno/',
    // CI/Governance
    '.github/workflows/',
    'docs/SSOT/',
    // Database schemas
    'prisma/',
    'packages/tenancy/',
    'migrations/',
    // Core API security
    'apps/core-api/src/authz/',
    'apps/core-api/src/rate-limit/',
    'apps/core-api/src/security/'
  ];
  
  for (const file of changedFiles) {
    for (const pattern of sensitivePatterns) {
      if (file.includes(pattern)) {
        console.log(`🔐 Sensitive path detected: ${file} (matches ${pattern})`);
        return true;
      }
    }
  }
  
  return false;
}

// Check if any spec artifacts exist
function hasSpecArtifacts() {
  try {
    const specDir = path.join(process.cwd(), SPEC_DIR);
    if (!existsSync(specDir)) {
      return false;
    }
    
    const files = readdirSync(specDir);
    const specFiles = files.filter(f => 
      f.match(/^\d{4}-\d{2}-\d{2}-.*\.md$/) && f.endsWith('.md')
    );
    
    return specFiles.length > 0;
  } catch (e) {
    console.warn('⚠️  Error checking for spec artifacts:', e instanceof Error ? e.message : String(e));
    return false;
  }
}

// Main validation
async function validateSpecArtifact() {
  if (!ENFORCE_SPEC_ARTIFACT) {
    console.log('ℹ️  Spec artifact enforcement disabled (ENFORCE_SPEC_ARTIFACT=false)');
    return true;
  }
  
  const changedFiles = getChangedFiles();
  console.log(`🔍 Analyzing ${changedFiles.length} changed files...`);
  
  // Always log what files were detected
  if (changedFiles.length > 0) {
    console.log('📝 Changed files:');
    changedFiles.slice(0, 10).forEach(f => console.log(`   - ${f}`));
    if (changedFiles.length > 10) {
      console.log(`   ... and ${changedFiles.length - 10} more`);
    }
  }
  
  if (!requiresSpec(changedFiles)) {
    console.log('✅ No spec required for these changes');
    
    // Additional check: if spec artifacts exist, encourage linking
    if (hasSpecArtifacts()) {
      console.log('💡 Note: Spec artifacts found. Consider linking if relevant.');
    }
    
    return true;
  }
  
  console.log('⚠️  Spec artifact required for these changes');
  
  // Check if PR declares spec not applicable
  const prBody = await getPRBody();
  const specNotApplicable = getSpecNotApplicable(prBody);
  
  if (specNotApplicable) {
    console.log(`✅ Spec N/A declared with reason: ${specNotApplicable}`);
    return true;
  }
  
  // Check if PR references a spec
  const specRef = getSpecReference(prBody);
  
  if (!specRef) {
    console.error('❌ No spec reference found in PR body');
    console.error('Required action:');
    console.error('1. Either add: Spec: .factory/docs/YYYY-MM-DD-descriptive-slug.md');
    console.error('2. Or declare: Spec N/A: [Brief reason for exemption]');
    console.error('');
    console.error('Example valid references:');
    console.error('- Spec: .factory/docs/2026-01-18-feature-implementation-plan.md');
    console.error('- Spec N/A: Minor typo fix in README');
    return false;
  }
  
  const specPath = path.join(process.cwd(), specRef);
  if (!existsSync(specPath)) {
    console.error(`❌ Spec file not found: ${specRef}`);
    console.error('Create the spec file and ensure the path is correct');
    return false;
  }
  
  console.log(`✅ Spec artifact validated: ${specRef}`);
  return true;
}

// CLI entry
if (require.main === module) {
  validateSpecArtifact()
    .then(ok => process.exit(ok ? 0 : 1))
    .catch(error => {
      console.error('❌ Unexpected error during spec validation:', error);
      process.exit(1);
    });
}

module.exports = { validateSpecArtifact, requiresSpec, getSpecReference, getSpecNotApplicable };
