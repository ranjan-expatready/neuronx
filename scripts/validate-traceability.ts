#!/usr/bin/env tsx

/**
 * Traceability Validation Script
 *
 * Ensures no drift between requirements and implementation by validating
 * that code changes in REQ-mapped modules require TRACEABILITY.md updates.
 *
 * Usage: tsx scripts/validate-traceability.ts
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

interface TraceabilityEntry {
  requirementId: string;
  codePath: string;
  status: string;
}

// Parse TRACEABILITY.md and extract mappings
function parseTraceabilityMatrix(): Map<string, TraceabilityEntry> {
  const traceabilityPath = path.join(process.cwd(), 'docs', 'TRACEABILITY.md');

  if (!existsSync(traceabilityPath)) {
    console.error('❌ docs/TRACEABILITY.md not found');
    process.exit(1);
  }

  const content = readFileSync(traceabilityPath, 'utf8');
  const lines = content.split('\n');

  const matrix = new Map<string, TraceabilityEntry>();
  let inMatrix = false;

  for (const line of lines) {
    // Find the matrix table
    if (line.includes('| Requirement ID |')) {
      inMatrix = true;
      continue;
    }

    if (!inMatrix || !line.includes('| REQ-')) {
      continue;
    }

    // Parse table row: | REQ-XXX | EPIC-XX | STORY-XX.XX | E2E-XX | code/path | test/path | evidence/path | status |
    const parts = line
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (parts.length >= 5) {
      const [reqId, epicId, storyId, e2eId, codePath] = parts;

      // Skip if not a valid REQ ID or marked as FUTURE/missing
      if (
        !reqId.startsWith('REQ-') ||
        codePath === 'N/A' ||
        codePath.includes('TBD')
      ) {
        continue;
      }

      matrix.set(codePath, {
        requirementId: reqId,
        codePath: codePath,
        status: parts[parts.length - 1] || 'unknown',
      });
    }
  }

  return matrix;
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

// Check if file is in a REQ-mapped module
function isReqMappedFile(
  filePath: string,
  traceabilityMatrix: Map<string, TraceabilityEntry>
): boolean {
  // Check if file is in monitored directories
  const monitoredPrefixes = ['apps/core-api/', 'packages/', 'apps/adapters/'];

  const isMonitored = monitoredPrefixes.some(prefix =>
    filePath.startsWith(prefix)
  );
  if (!isMonitored) {
    return false;
  }

  // Check if file matches any REQ-mapped code path
  for (const [codePath, entry] of traceabilityMatrix) {
    if (codePath !== 'N/A' && codePath !== 'TBD') {
      // Check if file path starts with the mapped code path
      if (filePath.startsWith(codePath.replace(/\/$/, ''))) {
        return true;
      }

      // Handle parent directory mappings (e.g., "apps/core-api/src/sales/" matches files in that directory)
      if (codePath.endsWith('/') && filePath.startsWith(codePath)) {
        return true;
      }
    }
  }

  return false;
}

// Check if TRACEABILITY.md was modified
function wasTraceabilityModified(): boolean {
  const changedFiles = getChangedFiles();
  return changedFiles.includes('docs/TRACEABILITY.md');
}

// Main validation function
function validateTraceability(): boolean {
  console.log(
    '🔍 Validating traceability between requirements and implementation...\n'
  );

  const traceabilityMatrix = parseTraceabilityMatrix();
  const changedFiles = getChangedFiles();
  const traceabilityModified = wasTraceabilityModified();

  console.log(`📊 Found ${traceabilityMatrix.size} requirement mappings`);
  console.log(`📝 Changed files: ${changedFiles.length}`);

  // Filter to REQ-mapped files that were changed
  const reqMappedChanges = changedFiles.filter(file =>
    isReqMappedFile(file, traceabilityMatrix)
  );

  if (reqMappedChanges.length === 0) {
    console.log('✅ No changes to REQ-mapped modules detected');
    return true;
  }

  console.log('⚠️  Changes detected in REQ-mapped modules:');
  reqMappedChanges.forEach(file => console.log(`   - ${file}`));

  if (!traceabilityModified) {
    console.error('\n❌ REQUIREMENT DRIFT DETECTED!');
    console.error(
      'Code changes in REQ-mapped modules require TRACEABILITY.md updates.'
    );
    console.error('\nRequired action:');
    console.error('1. Update docs/TRACEABILITY.md to reflect code changes');
    console.error(
      '2. Ensure requirement acceptance criteria match implementation'
    );
    console.error('3. Add/update test and evidence path mappings');
    console.error(
      '\nFailure reason: Code changes without documentation updates create drift.'
    );
    return false;
  }

  console.log('✅ TRACEABILITY.md was updated alongside code changes');
  return true;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const isValid = validateTraceability();
  process.exit(isValid ? 0 : 1);
}

export { validateTraceability, parseTraceabilityMatrix, isReqMappedFile };
