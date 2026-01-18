#!/usr/bin/env node

/**
 * Fixture Validation Script
 *
 * Validates the integrity of test fixtures to ensure:
 * - Required fixtures exist
 * - JSON syntax is valid
 * - Data structure conforms to expected schemas
 * - References between fixtures are consistent
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'e2e', 'fixtures');

/**
 * Fixture schema definitions for validation
 */
const SCHEMAS = {
  lead: {
    required: ['id', 'firstName', 'email', 'company'],
    types: {
      id: 'string',
      firstName: 'string',
      lastName: 'string',
      email: 'string',
      phone: 'string',
      company: 'string',
      industry: 'string',
      companySize: 'number',
      tenantId: 'string',
    },
  },
  tenant: {
    required: ['id', 'name', 'domain'],
    types: {
      id: 'string',
      name: 'string',
      domain: 'string',
      status: 'string',
    },
  },
  webhook: {
    required: ['id', 'type', 'payload'],
    types: {
      id: 'string',
      tenantId: 'string',
      type: 'string',
      timestamp: 'string',
      payload: 'object',
    },
  },
  conversation: {
    required: ['id', 'leadId', 'messages'],
    types: {
      id: 'string',
      leadId: 'string',
      tenantId: 'string',
      messages: 'object',
      summary: 'object',
    },
  },
  scoring: {
    required: ['leadId', 'originalScore', 'enhancedScore'],
    types: {
      leadId: 'string',
      tenantId: 'string',
      originalScore: 'number',
      enhancedScore: 'number',
      adjustment: 'number',
      confidence: 'number',
      factors: 'object',
      reasoning: 'object',
    },
  },
  routing: {
    required: ['leadId', 'recommendedTeam'],
    types: {
      leadId: 'string',
      tenantId: 'string',
      recommendedTeam: 'object',
      confidence: 'number',
      reasoning: 'object',
      alternatives: 'object',
      factors: 'object',
    },
  },
};

/**
 * Validate a single fixture file
 */
function validateFixture(filePath, schema) {
  const errors = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Check required fields
    for (const field of schema.required) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Check field types
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (field in data) {
        const actualType = Array.isArray(data[field])
          ? 'array'
          : typeof data[field];
        const normalizedExpected =
          expectedType === 'object' ? 'object' : expectedType;

        if (actualType !== normalizedExpected) {
          errors.push(
            `Field '${field}' has type '${actualType}', expected '${expectedType}'`
          );
        }
      }
    }

    // Additional validations
    if (data.email && !isValidEmail(data.email)) {
      errors.push(`Invalid email format: ${data.email}`);
    }

    if (data.id && typeof data.id === 'string' && data.id.length < 3) {
      errors.push(`ID too short: ${data.id}`);
    }
  } catch (error) {
    errors.push(`Parse error: ${error.message}`);
  }

  return errors;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate cross-fixture references
 */
function validateReferences(allFixtures) {
  const errors = [];
  const leads = allFixtures.neuronx?.lead || {};
  const conversations = allFixtures.neuronx?.conversation || {};
  const scorings = allFixtures.neuronx?.scoring || {};
  const routings = allFixtures.neuronx?.routing || {};

  // Check conversation references to leads
  Object.values(conversations).forEach(conv => {
    if (conv.leadId && !(conv.leadId in leads)) {
      errors.push(
        `Conversation ${conv.id} references unknown lead: ${conv.leadId}`
      );
    }
  });

  // Check scoring references to leads
  Object.values(scorings).forEach(score => {
    if (score.leadId && !(score.leadId in leads)) {
      errors.push(
        `Scoring ${score.leadId} references unknown lead: ${score.leadId}`
      );
    }
  });

  // Check routing references to leads
  Object.values(routings).forEach(route => {
    if (route.leadId && !(route.leadId in leads)) {
      errors.push(
        `Routing ${route.leadId} references unknown lead: ${route.leadId}`
      );
    }
  });

  return errors;
}

/**
 * Main validation function
 */
function validateAllFixtures() {
  const results = {
    valid: true,
    totalFiles: 0,
    validFiles: 0,
    invalidFiles: 0,
    errors: [],
    warnings: [],
  };

  if (!fs.existsSync(FIXTURES_DIR)) {
    results.errors.push('Fixtures directory does not exist');
    results.valid = false;
    return results;
  }

  const allFixtures = {};
  const fixtureFiles = fs
    .readdirSync(FIXTURES_DIR, { recursive: true })
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(FIXTURES_DIR, file));

  console.log(`🔍 Validating ${fixtureFiles.length} fixture files...`);

  for (const filePath of fixtureFiles) {
    results.totalFiles++;
    const relativePath = path.relative(FIXTURES_DIR, filePath);
    const [category, type] = relativePath.split(path.sep);

    if (!SCHEMAS[type]) {
      results.warnings.push(
        `No schema defined for fixture type: ${type} (${relativePath})`
      );
      continue;
    }

    const schema = SCHEMAS[type];
    const errors = validateFixture(filePath, schema);

    if (errors.length > 0) {
      results.invalidFiles++;
      results.errors.push(`❌ ${relativePath}:`);
      errors.forEach(error => results.errors.push(`   ${error}`));
    } else {
      results.validFiles++;

      // Load valid fixtures for cross-reference validation
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);

        if (!allFixtures[category]) allFixtures[category] = {};
        if (!allFixtures[category][type]) allFixtures[category][type] = {};

        // Use a key for the fixture (could be ID or filename)
        const key = data.id || path.basename(filePath, '.json');
        allFixtures[category][type][key] = data;
      } catch (error) {
        results.errors.push(
          `Failed to load fixture for cross-referencing: ${relativePath}`
        );
      }
    }
  }

  // Cross-reference validation
  const referenceErrors = validateReferences(allFixtures);
  results.errors.push(...referenceErrors);

  results.valid = results.errors.length === 0 && results.invalidFiles === 0;
  results.invalidFiles += referenceErrors.length > 0 ? 1 : 0; // Count cross-reference as one "file"

  return results;
}

/**
 * Generate validation report
 */
function generateReport(results) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(
    __dirname,
    '..',
    'docs',
    'EVIDENCE',
    `fixture_validation_${timestamp.slice(0, 19).replace(/:/g, '-')}.md`
  );

  let report = `# Fixture Validation Report

**Timestamp:** ${timestamp}
**Status:** ${results.valid ? '✅ PASSED' : '❌ FAILED'}

## Summary
- **Total Files:** ${results.totalFiles}
- **Valid Files:** ${results.validFiles}
- **Invalid Files:** ${results.invalidFiles}

## Errors
${results.errors.length > 0 ? results.errors.map(error => `- ${error}`).join('\n') : 'None'}

## Warnings
${results.warnings.length > 0 ? results.warnings.map(warning => `- ${warning}`).join('\n') : 'None'}

## Recommendations
`;

  if (!results.valid) {
    report += `
### Immediate Actions Required
${results.errors.length > 0 ? '- Fix all validation errors listed above' : ''}
${results.invalidFiles > 0 ? '- Correct fixture file formats and required fields' : ''}
${results.warnings.length > 0 ? '- Address schema warnings for better test reliability' : ''}

### Prevention
- Run fixture validation before committing changes
- Use the fixture validation script in CI pipelines
- Keep fixture schemas updated with domain model changes
`;
  } else {
    report += `
### All Clear ✅
- All fixtures are valid and properly structured
- Cross-references are consistent
- Ready for test execution
`;
  }

  fs.writeFileSync(reportPath, report);
  console.log(`📄 Validation report saved: ${reportPath}`);

  return reportPath;
}

/**
 * Main execution
 */
function main() {
  console.log('🧪 Starting fixture validation...\n');

  const results = validateAllFixtures();

  console.log(`\n📊 Results:`);
  console.log(`   Total files: ${results.totalFiles}`);
  console.log(`   Valid: ${results.validFiles}`);
  console.log(`   Invalid: ${results.invalidFiles}`);
  console.log(`   Warnings: ${results.warnings.length}`);

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    results.errors.forEach(error => console.log(`   ${error}`));
  }

  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    results.warnings.forEach(warning => console.log(`   ${warning}`));
  }

  const reportPath = generateReport(results);

  console.log(
    `\n${results.valid ? '✅' : '❌'} Validation ${results.valid ? 'PASSED' : 'FAILED'}`
  );
  console.log(`📄 Report: ${reportPath}`);

  process.exit(results.valid ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateAllFixtures, generateReport };
