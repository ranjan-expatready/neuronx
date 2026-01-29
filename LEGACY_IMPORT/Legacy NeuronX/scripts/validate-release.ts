#!/usr/bin/env tsx

/**
 * Release Validation Script - WI-026: Release & Environment Hardening
 *
 * Comprehensive pre-deployment validation.
 * Ensures build is safe to deploy to production.
 */

import { execSync } from 'child_process';

async function validateRelease() {
  console.log('🚀 Running comprehensive release validation...');

  const validations = [
    {
      name: 'Config Validation',
      command: 'npm run validate:config',
      description: 'Validates environment configuration against schema',
    },
    {
      name: 'Observability Artifacts',
      command: 'npm run validate:observability-artifacts',
      description: 'Validates metrics, dashboards, and alert rules',
    },
    {
      name: 'Traceability',
      command: 'npm run validate:traceability',
      description: 'Validates requirements to implementation mapping',
    },
    {
      name: 'Migrations',
      command: 'npm run validate:migrations',
      description: 'Validates Prisma schema and migrations',
    },
  ];

  let allPassed = true;

  for (const validation of validations) {
    console.log(`\n📋 Running ${validation.name}...`);
    console.log(`   ${validation.description}`);

    try {
      execSync(validation.command, { stdio: 'inherit' });
      console.log(`✅ ${validation.name} passed`);
    } catch (error) {
      console.error(`❌ ${validation.name} failed`);
      allPassed = false;
      // Continue with other validations to show all failures
    }
  }

  console.log('\n' + '='.repeat(50));

  if (allPassed) {
    console.log('🎉 All release validations passed!');
    console.log('✈️  Build is safe to deploy');
    process.exit(0);
  } else {
    console.error('💥 Release validation failed!');
    console.error('🛑 Build is NOT safe to deploy');
    console.error('Please fix the validation errors above before deploying.');
    process.exit(1);
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateRelease();
}
