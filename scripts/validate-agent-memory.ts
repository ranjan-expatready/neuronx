#!/usr/bin/env tsx

/**
 * Agent Memory Validation Script
 *
 * Validates that docs/SSOT/10_AGENT_MEMORY.md was properly updated when:
 * 1. Any files outside docs/ were changed
 * 2. Any evidence folders were created/modified
 *
 * Usage: npx tsx scripts/validate-agent-memory.ts
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function getChangedFiles(): string[] {
  try {
    // Get staged changes (what will be committed)
    const stagedOutput = execSync('git diff --name-only --staged', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    // Get unstaged changes (working directory modifications)
    const unstagedOutput = execSync('git diff --name-only', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    const allChanges = [
      ...stagedOutput.split('\n'),
      ...unstagedOutput.split('\n'),
    ]
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index); // deduplicate

    return allChanges;
  } catch (error) {
    console.log('ℹ️ Git command failed, skipping validation');
    return [];
  }
}

function hasEvidenceChanges(changedFiles: string[]): boolean {
  return changedFiles.some(file => file.startsWith('docs/EVIDENCE/'));
}

function hasNonDocsChanges(changedFiles: string[]): boolean {
  return changedFiles.some(file => !file.startsWith('docs/'));
}

function validateMemoryFile(): boolean {
  const memoryPath = 'docs/SSOT/10_AGENT_MEMORY.md';

  if (!existsSync(memoryPath)) {
    console.error('❌ docs/SSOT/10_AGENT_MEMORY.md does not exist');
    return false;
  }

  try {
    const content = readFileSync(memoryPath, 'utf-8');

    // Check for required sections
    const requiredSections = [
      'Last Updated (UTC):',
      'Current Focus:',
      'Short-Term:',
      'STOP-SHIP Ledger:',
      'Evidence Links:',
      'UNKNOWNs:',
    ];

    const missingSections = requiredSections.filter(
      section => !content.includes(section)
    );

    if (missingSections.length > 0) {
      console.error('❌ Missing required sections in agent memory:');
      console.error(`❌ First missing section: "${missingSections[0]}"`);
      console.error('');
      console.error('🔧 Remediation:');
      console.error('1. If you use Continue CLI: cn -p "SESSION_CLOSE"');
      console.error(
        "2. If cn not installed: run Continue's SESSION_CLOSE prompt in your Continue UI and apply the produced diff via Cursor"
      );
      console.error(
        '3. Then commit docs/SSOT/10_AGENT_MEMORY.md in the same commit as the related changes.'
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error reading agent memory file:', error);
    return false;
  }
}

function main() {
  console.log('🔍 Validating agent memory updates...');

  const changedFiles = getChangedFiles();
  console.log(`📝 Changed files: ${changedFiles.length}`);

  if (changedFiles.length === 0) {
    console.log('✅ No files changed, memory validation skipped');
    return;
  }

  // Check if memory validation is required
  const evidenceChanged = hasEvidenceChanges(changedFiles);
  const nonDocsChanged = hasNonDocsChanges(changedFiles);

  if (!evidenceChanged && !nonDocsChanged) {
    console.log('✅ Only docs/ files changed, memory validation not required');
    return;
  }

  console.log(
    '🔍 Memory validation required (evidence or non-docs changes detected)'
  );

  // Validate memory file structure
  if (!validateMemoryFile()) {
    console.error('');
    console.error('🔧 Remediation:');
    console.error('1. Run SESSION_CLOSE prompt: cn -p "SESSION_CLOSE"');
    console.error('2. Or manually update docs/SSOT/10_AGENT_MEMORY.md with:');
    console.error('   - Last Updated (UTC): [current timestamp]');
    console.error('   - Short-Term: [what was accomplished]');
    console.error('   - STOP-SHIP Ledger: [any critical findings]');
    console.error('   - Evidence Links: [any docs/EVIDENCE/ paths]');
    console.error('3. Commit the memory update');
    process.exit(1);
  }

  console.log('✅ Agent memory validation passed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
