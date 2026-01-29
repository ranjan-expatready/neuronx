#!/usr/bin/env node

/**
 * Readiness Check CLI - WI-039: Customer Onboarding Golden Path
 */

const { checkTenantReadiness } = require('../dist/index.js');
const { Command } = require('commander');

async function main() {
  const program = new Command();

  program
    .name('check-readiness')
    .description('Check tenant readiness for production operations')
    .version('1.0.0')
    .requiredOption('-t, --tenant-id <id>', 'Tenant ID to check')
    .option('-v, --verbose', 'Show detailed check results')
    .option('--no-ghl-check', 'Skip GHL connection check')
    .option('--json', 'Output results as JSON');

  program.parse();

  const options = program.opts();
  options.checkGhlConnection = !options.noGhlCheck;

  try {
    console.log(`🔍 Checking readiness for tenant: ${options.tenantId}`);

    const result = await checkTenantReadiness({
      tenantId: options.tenantId,
      verbose: options.verbose,
      checkGhlConnection: options.checkGhlConnection,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printReadinessResult(result, options.verbose);
    }

    process.exit(result.status === 'READY' ? 0 : 1);
  } catch (error) {
    console.error('❌ Readiness check failed:', error.message);
    console.error('\nUsage:');
    program.help();
    process.exit(1);
  }
}

function printReadinessResult(result, verbose = false) {
  console.log('\n' + '='.repeat(60));
  console.log(`TENANT READINESS CHECK - ${result.tenantId.toUpperCase()}`);
  console.log('='.repeat(60));

  // Status header
  if (result.status === 'READY') {
    console.log('✅ STATUS: READY FOR PRODUCTION');
  } else {
    console.log('❌ STATUS: BLOCKED');
    if (result.estimatedTimeToReady) {
      console.log(`⏱️ ESTIMATED TIME TO READY: ${result.estimatedTimeToReady}`);
    }
  }

  // Summary
  const { summary } = result;
  console.log(`\n📊 SUMMARY: ${summary.passed}/${summary.total} checks passed`);
  console.log(`   ✅ Passed: ${summary.passed}`);
  console.log(`   ❌ Failed: ${summary.failed}`);
  console.log(`   ⚠️ Warnings: ${summary.warnings}`);

  // Check results
  console.log('\n🔍 CHECK RESULTS:');
  for (const check of result.checks) {
    const icon =
      check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`   ${icon} ${check.name}: ${check.message}`);

    if (verbose && check.details) {
      console.log(`      Details: ${JSON.stringify(check.details, null, 2)}`);
    }

    if (check.status !== 'PASS' && check.remediation) {
      console.log(`      💡 ${check.remediation}`);
    }
  }

  // Next steps
  if (result.nextSteps.length > 0) {
    console.log('\n🚀 NEXT STEPS:');
    result.nextSteps.forEach(step => {
      console.log(`   • ${step}`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
