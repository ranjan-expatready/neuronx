/* eslint-env node */
/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASELINE_FILE = path.join(__dirname, '../docs/ship_readiness/quality-baseline.json');
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function loadBaseline() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  } catch (error) {
    console.error(`${RED}❌ Failed to load baseline file: ${BASELINE_FILE}${RESET}`);
    process.exit(1);
  }
}

function runCommand(command) {
  try {
    // redirect stderr to stdout to capture warnings if needed, but for now just run
    return execSync(command, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
  } catch (error) {
    // If the command fails (exit code != 0), return the stdout/stderr
    return error.stdout + error.stderr;
  }
}

function countLintErrors() {
  console.log('🧹 Running Lint...');
  const output = runCommand('pnpm run lint --format json');
  
  // Parse JSON output. Note: output might contain non-JSON noise (pnpm warnings).
  // We'll extract the JSON array part.
  const jsonStart = output.indexOf('[');
  const jsonEnd = output.lastIndexOf(']');
  
  if (jsonStart === -1 || jsonEnd === -1) {
      console.error(`${RED}❌ Failed to parse lint output.${RESET}`);
      return 999999; // Fail safe
  }
  
  try {
      const jsonStr = output.substring(jsonStart, jsonEnd + 1);
      const results = JSON.parse(jsonStr);
      return results.reduce((sum, file) => sum + file.errorCount, 0);
  } catch (e) {
      // Fallback to regex if JSON parse fails
      const matches = output.match(/"errorCount":(\d+)/g);
      if (!matches) return 0;
      return matches.reduce((sum, match) => {
          const count = parseInt(match.split(':')[1]);
          return sum + count;
      }, 0);
  }
}

function countTypeErrors() {
  console.log('📏 Running Typecheck...');
  const output = runCommand('pnpm run typecheck');
  // Count occurrences of "error TS"
  const matches = output.match(/error TS\d+/g);
  return matches ? matches.length : 0;
}

function main() {
  console.log('🛡️  Starting Quality Ratchet Check...');
  
  // 0. Check Baseline Integrity (Governance)
  if (process.env.ALLOW_BASELINE_UPDATE !== '1') {
    const relativeBaselinePath = 'docs/ship_readiness/quality-baseline.json';
    try {
      // Check for local modifications
      const status = runCommand(`git status --porcelain ${relativeBaselinePath}`);
      // Check for committed modifications in HEAD
      const diff = runCommand(`git diff --name-only HEAD~1 HEAD -- ${relativeBaselinePath}`);
      
      if (status.trim() || diff.trim()) {
        console.log(`${RED}❌ Baseline file modified without ALLOW_BASELINE_UPDATE=1.${RESET}`);
        console.log(`${YELLOW}   Quality baseline can only be modified explicitly.${RESET}`);
        console.log(`${YELLOW}   Run with ALLOW_BASELINE_UPDATE=1 to bypass.${RESET}`);
        process.exit(1);
      }
    } catch (e) {
      // Ignore git errors (e.g. no git repo), mostly for local dev safety
    }
  }

  const baseline = loadBaseline();
  let failed = false;

  // 1. Check Lint
  const currentLint = countLintErrors();
  console.log(`   Lint Issues: ${currentLint} (Baseline: ${baseline.lint_issues})`);
  
  if (currentLint > baseline.lint_issues) {
    console.log(`${RED}❌ Lint issues increased! Found ${currentLint}, expected <= ${baseline.lint_issues}${RESET}`);
    console.log(`${YELLOW}   Please fix the new lint errors.${RESET}`);
    failed = true;
  } else if (currentLint < baseline.lint_issues) {
    console.log(`${GREEN}🎉 Lint issues decreased! (${currentLint} < ${baseline.lint_issues})${RESET}`);
    console.log(`${YELLOW}   Update baseline in docs/ship_readiness/quality-baseline.json${RESET}`);
    // Optionally auto-update baseline? For now, just warn.
  } else {
    console.log(`${GREEN}✅ Lint issues within baseline.${RESET}`);
  }

  // 2. Check Typecheck
  const currentType = countTypeErrors();
  console.log(`   Type Errors: ${currentType} (Baseline: ${baseline.type_errors})`);

  if (currentType > baseline.type_errors) {
    console.log(`${RED}❌ Type errors increased! Found ${currentType}, expected <= ${baseline.type_errors}${RESET}`);
    console.log(`${YELLOW}   Please fix the new type errors.${RESET}`);
    failed = true;
  } else if (currentType < baseline.type_errors) {
    console.log(`${GREEN}🎉 Type errors decreased! (${currentType} < ${baseline.type_errors})${RESET}`);
    console.log(`${YELLOW}   Update baseline in docs/ship_readiness/quality-baseline.json${RESET}`);
  } else {
    console.log(`${GREEN}✅ Type errors within baseline.${RESET}`);
  }

  if (failed) {
    console.log(`${RED}❌ Quality Ratchet Check Failed.${RESET}`);
    process.exit(1);
  } else {
    console.log(`${GREEN}✅ Quality Ratchet Check Passed.${RESET}`);
  }
}

main();
