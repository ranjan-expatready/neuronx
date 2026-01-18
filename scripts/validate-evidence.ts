#!/usr/bin/env tsx

/**
 * Evidence Validation Script
 *
 * Ensures integration work has required evidence artifacts for auditability.
 *
 * Usage: tsx scripts/validate-evidence.ts
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

interface EvidenceRequirement {
  trigger: string;
  evidencePath: string;
  requiredContent: string[];
}

// Get files changed in this PR/commit
function getChangedFiles(): string[] {
  try {
    // Get files changed compared to main branch
    const output = execSync('git diff --name-only origin/main...HEAD', {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    return output
      .trim()
      .split('\n')
      .filter(line => line.length > 0);
  } catch (error) {
    // If no origin/main, try with main branch
    try {
      const output = execSync('git diff --name-only main...HEAD', {
        encoding: 'utf8',
        cwd: process.cwd(),
      });

      return output
        .trim()
        .split('\n')
        .filter(line => line.length > 0);
    } catch (fallbackError) {
      console.warn(
        '⚠️  Could not determine changed files (no main branch found)'
      );
      return [];
    }
  }
}

// Check if changes require evidence
function requiresEvidence(changedFiles: string[]): EvidenceRequirement | null {
  // Check for integration code changes
  const hasIntegrationChanges = changedFiles.some(
    file =>
      file.includes('/integrations/') ||
      file.includes('/adapters/') ||
      file.includes('packages/integrations/') ||
      file.includes('packages/adapters/')
  );

  // Check for webhook handler changes
  const hasWebhookChanges = changedFiles.some(
    file => file.includes('webhook') || file.includes('packages/webhooks/')
  );

  // Check for E2E scenario changes
  const hasE2EChanges = changedFiles.some(
    file => file.includes('tests/e2e/') || file.includes('E2E_SCENARIOS.md')
  );

  if (hasIntegrationChanges || hasWebhookChanges) {
    return {
      trigger: 'integration_changes',
      evidencePath: `docs/EVIDENCE/integrations/${getCurrentDate()}/README.md`,
      requiredContent: [
        'What integration was implemented',
        'External system endpoints tested',
        'Authentication method validated',
        'Error handling scenarios covered',
        'Link to test execution results',
      ],
    };
  }

  if (hasE2EChanges) {
    return {
      trigger: 'e2e_changes',
      evidencePath: `docs/EVIDENCE/e2e/${getCurrentDate()}/README.md`,
      requiredContent: [
        'E2E scenarios tested',
        'User journey validated',
        'External system interactions confirmed',
        'Performance benchmarks met',
        'Link to test execution artifacts',
      ],
    };
  }

  return null;
}

// Get current date in YYYY-MM-DD format
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Validate evidence file exists and has required content
function validateEvidenceFile(
  evidencePath: string,
  requiredContent: string[]
): boolean {
  if (!existsSync(evidencePath)) {
    console.error(`❌ Evidence file missing: ${evidencePath}`);
    console.error('Required content:');
    requiredContent.forEach(item => console.error(`   - ${item}`));
    return false;
  }

  const content = readFileSync(evidencePath, 'utf8');

  const missingContent = requiredContent.filter(
    item => !content.toLowerCase().includes(item.toLowerCase())
  );

  if (missingContent.length > 0) {
    console.error(`❌ Evidence file incomplete: ${evidencePath}`);
    console.error('Missing required content:');
    missingContent.forEach(item => console.error(`   - ${item}`));
    return false;
  }

  return true;
}

// Check for any existing evidence directories that might be relevant
function checkExistingEvidence(): string[] {
  const evidenceDir = path.join(process.cwd(), 'docs', 'EVIDENCE');
  if (!existsSync(evidenceDir)) {
    return [];
  }

  const areas = ['integrations', 'e2e', 'requirements'];
  const existingEvidence: string[] = [];

  areas.forEach(area => {
    const areaPath = path.join(evidenceDir, area);
    if (existsSync(areaPath)) {
      const entries = readdirSync(areaPath);
      entries.forEach(entry => {
        const entryPath = path.join(areaPath, entry);
        if (statSync(entryPath).isDirectory()) {
          const readmePath = path.join(entryPath, 'README.md');
          if (existsSync(readmePath)) {
            existingEvidence.push(readmePath);
          }
        }
      });
    }
  });

  return existingEvidence;
}

// Main validation function
function validateEvidence(): boolean {
  console.log('🔍 Validating evidence requirements for integration work...\n');

  const changedFiles = getChangedFiles();
  const evidenceRequirement = requiresEvidence(changedFiles);

  if (!evidenceRequirement) {
    console.log('✅ No evidence required for these changes');
    return true;
  }

  console.log(`📋 Evidence required due to: ${evidenceRequirement.trigger}`);
  console.log(`📁 Required evidence path: ${evidenceRequirement.evidencePath}`);

  // Check if evidence file exists and is complete
  const isValid = validateEvidenceFile(
    evidenceRequirement.evidencePath,
    evidenceRequirement.requiredContent
  );

  if (!isValid) {
    console.error('\n❌ EVIDENCE REQUIREMENT NOT MET!');
    console.error('Integration/webhook/E2E work requires evidence artifacts.');
    console.error('\nRequired action:');
    console.error(`1. Create ${evidenceRequirement.evidencePath}`);
    console.error('2. Include all required content sections');
    console.error('3. Link to actual test outputs and CI results');
    console.error(
      '\nFailure reason: Integration work without evidence creates audit gaps.'
    );
    return false;
  }

  // Check for any existing evidence that might be more appropriate
  const existingEvidence = checkExistingEvidence();
  if (existingEvidence.length > 0) {
    console.log('\nℹ️  Note: Existing evidence found:');
    existingEvidence.forEach(path => console.log(`   - ${path}`));
  }

  console.log('✅ Evidence requirements satisfied');
  return true;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const isValid = validateEvidence();
  process.exit(isValid ? 0 : 1);
}

export { validateEvidence, requiresEvidence, validateEvidenceFile };
