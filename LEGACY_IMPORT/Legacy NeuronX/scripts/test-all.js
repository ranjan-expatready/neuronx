#!/usr/bin/env node

/**
 * NeuronX Comprehensive Test Runner
 *
 * Runs all test suites in the correct order with proper setup and teardown.
 * Captures evidence and generates reports for all test runs.
 *
 * Usage:
 *   npm run test:all                    # Run all tests
 *   npm run test:all -- --quick         # Skip slow tests
 *   npm run test:all -- --unit-only     # Unit tests only
 *   npm run test:all -- --no-evidence   # Skip evidence capture
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TYPES = {
  UNIT: 'unit',
  INTEGRATION: 'integration',
  CONTRACT: 'contract',
  API: 'api',
  E2E: 'e2e',
  CYPRESS: 'cypress',
  LOAD: 'load',
  SECURITY: 'security',
};

class TestRunner {
  constructor(options = {}) {
    this.options = {
      quick: false,
      unitOnly: false,
      skipEvidence: false,
      verbose: false,
      ...options,
    };

    this.results = {
      startTime: new Date(),
      endTime: null,
      suites: {},
      overall: {
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      },
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix =
      level === 'error'
        ? '❌'
        : level === 'warn'
          ? '⚠️'
          : level === 'success'
            ? '✅'
            : 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const cmd = spawn(command, args, {
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        cwd: path.join(__dirname, '..'),
        ...options,
      });

      let stdout = '';
      let stderr = '';

      if (!this.options.verbose) {
        cmd.stdout?.on('data', data => {
          stdout += data.toString();
        });

        cmd.stderr?.on('data', data => {
          stderr += data.toString();
        });
      }

      cmd.on('close', code => {
        if (code === 0) {
          resolve({ code, stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      cmd.on('error', error => {
        reject(error);
      });
    });
  }

  async runUnitTests() {
    this.log('Running unit tests with Vitest...');

    try {
      const result = await this.runCommand('npx', [
        'vitest',
        'run',
        '--coverage',
      ]);
      this.results.suites[TEST_TYPES.UNIT] = {
        status: 'passed',
        duration: 0, // Could parse from output
        output: result.stdout,
      };
      this.log('Unit tests completed successfully', 'success');
      return true;
    } catch (error) {
      this.results.suites[TEST_TYPES.UNIT] = {
        status: 'failed',
        error: error.message,
      };
      this.log(`Unit tests failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runIntegrationTests() {
    this.log('Running integration tests...');

    try {
      // Run contract tests
      await this.runCommand('npx', ['vitest', 'run', 'test/contract']);

      // Run API integration tests
      if (!this.options.skipEvidence) {
        await this.runCommand('npm', ['install', '-g', 'newman']);
        await this.runCommand('newman', [
          'run',
          'postman/NeuronX_API_Collection.postman_collection.json',
          '--environment',
          'postman/NeuronX_Dev_Environment.postman_environment.json',
          '--reporters',
          'cli,json',
          '--reporter-json-export',
          'api-test-results.json',
        ]);
      }

      this.results.suites[TEST_TYPES.INTEGRATION] = { status: 'passed' };
      this.log('Integration tests completed successfully', 'success');
      return true;
    } catch (error) {
      this.results.suites[TEST_TYPES.INTEGRATION] = {
        status: 'failed',
        error: error.message,
      };
      this.log(`Integration tests failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runE2ETests() {
    if (this.options.quick || this.options.unitOnly) {
      this.log('Skipping E2E tests (--quick or --unit-only flag used)');
      this.results.suites[TEST_TYPES.E2E] = { status: 'skipped' };
      return true;
    }

    this.log('Running E2E tests with Playwright...');

    try {
      await this.runCommand('npx', ['playwright', 'test']);
      this.results.suites[TEST_TYPES.E2E] = { status: 'passed' };
      this.log('E2E tests completed successfully', 'success');
      return true;
    } catch (error) {
      this.results.suites[TEST_TYPES.E2E] = {
        status: 'failed',
        error: error.message,
      };
      this.log(`E2E tests failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runCypressTests() {
    if (this.options.quick || this.options.unitOnly) {
      this.log('Skipping Cypress tests (--quick or --unit-only flag used)');
      this.results.suites[TEST_TYPES.CYPRESS] = { status: 'skipped' };
      return true;
    }

    this.log('Running Cypress E2E tests...');

    try {
      await this.runCommand('npx', ['cypress', 'run']);
      this.results.suites[TEST_TYPES.CYPRESS] = { status: 'passed' };
      this.log('Cypress tests completed successfully', 'success');
      return true;
    } catch (error) {
      this.results.suites[TEST_TYPES.CYPRESS] = {
        status: 'failed',
        error: error.message,
      };
      this.log(`Cypress tests failed: ${error.message}`, 'error');
      return false;
    }
  }

  async runLoadTests() {
    if (this.options.quick) {
      this.log('Skipping load tests (--quick flag used)');
      this.results.suites[TEST_TYPES.LOAD] = { status: 'skipped' };
      return true;
    }

    this.log('Running load tests...');

    try {
      // Run a quick load test (5 leads/min for 1 minute)
      await this.runCommand('node', ['scripts/load-test-phase4c.js', '5', '1']);
      this.results.suites[TEST_TYPES.LOAD] = { status: 'passed' };
      this.log('Load tests completed successfully', 'success');
      return true;
    } catch (error) {
      this.results.suites[TEST_TYPES.LOAD] = {
        status: 'failed',
        error: error.message,
      };
      this.log(`Load tests failed: ${error.message}`, 'error');
      return false;
    }
  }

  async captureEvidence() {
    if (this.options.skipEvidence) {
      this.log('Skipping evidence capture (--no-evidence flag used)');
      return;
    }

    this.log('Capturing test evidence...');

    try {
      // Run evidence capture script
      await this.runCommand('node', ['scripts/capture-evidence.js']);

      this.log('Evidence capture completed', 'success');
    } catch (error) {
      this.log(`Evidence capture failed: ${error.message}`, 'warn');
    }
  }

  generateReport() {
    this.results.endTime = new Date();
    this.results.overall.duration =
      this.results.endTime - this.results.startTime;

    const report = {
      title: 'NeuronX Comprehensive Test Report',
      timestamp: this.results.endTime.toISOString(),
      duration: `${Math.round(this.results.overall.duration / 1000)}s`,
      configuration: this.options,
      suites: Object.entries(this.results.suites).map(([name, result]) => ({
        name,
        status: result.status,
        duration: result.duration || 'N/A',
        error: result.error || null,
      })),
      summary: {
        totalSuites: Object.keys(this.results.suites).length,
        passedSuites: Object.values(this.results.suites).filter(
          s => s.status === 'passed'
        ).length,
        failedSuites: Object.values(this.results.suites).filter(
          s => s.status === 'failed'
        ).length,
        skippedSuites: Object.values(this.results.suites).filter(
          s => s.status === 'skipped'
        ).length,
      },
    };

    return report;
  }

  printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 NEURONX COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));
    console.log(`📅 Timestamp: ${report.timestamp}`);
    console.log(`⏱️  Duration: ${report.duration}`);
    console.log(`⚙️  Configuration: ${JSON.stringify(report.configuration)}`);
    console.log('');

    console.log('📊 SUITE RESULTS:');
    console.log('-'.repeat(50));

    const statusIcons = {
      passed: '✅',
      failed: '❌',
      skipped: '⏭️',
    };

    report.suites.forEach(suite => {
      const icon = statusIcons[suite.status] || '❓';
      console.log(
        `${icon} ${suite.name.padEnd(15)} ${suite.status.padEnd(8)} ${suite.duration}`
      );

      if (suite.error) {
        console.log(`   Error: ${suite.error}`);
      }
    });

    console.log('');
    console.log('📈 SUMMARY:');
    console.log('-'.repeat(30));
    console.log(`Total Suites:  ${report.summary.totalSuites}`);
    console.log(`✅ Passed:      ${report.summary.passedSuites}`);
    console.log(`❌ Failed:      ${report.summary.failedSuites}`);
    console.log(`⏭️  Skipped:     ${report.summary.skippedSuites}`);

    const overallStatus = report.summary.failedSuites > 0 ? 'FAILED' : 'PASSED';
    const statusIcon = overallStatus === 'PASSED' ? '🎉' : '💥';

    console.log('');
    console.log(`${statusIcon} OVERALL RESULT: ${overallStatus}`);
    console.log('='.repeat(80));
  }

  async run() {
    this.log('🚀 Starting NeuronX comprehensive test suite...');

    const suites = [];

    // Always run unit tests
    suites.push(this.runUnitTests());

    if (!this.options.unitOnly) {
      suites.push(this.runIntegrationTests());
      suites.push(this.runE2ETests());
      suites.push(this.runCypressTests());
      suites.push(this.runLoadTests());
    }

    // Run all suites in parallel where possible
    const results = await Promise.allSettled(suites);

    // Capture evidence after all tests complete
    await this.captureEvidence();

    // Generate and print report
    const report = this.generateReport();
    this.printReport(report);

    // Save detailed report
    const reportPath = path.join(
      __dirname,
      '..',
      'docs',
      'EVIDENCE',
      'test_all_report.json'
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Exit with appropriate code
    const hasFailures = results.some(
      result =>
        result.status === 'rejected' ||
        (result.status === 'fulfilled' && result.value === false)
    );

    process.exit(hasFailures ? 1 : 0);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  args.forEach(arg => {
    switch (arg) {
      case '--quick':
        options.quick = true;
        break;
      case '--unit-only':
        options.unitOnly = true;
        break;
      case '--no-evidence':
        options.skipEvidence = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
    }
  });

  return options;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  const runner = new TestRunner(options);
  runner.run().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export default TestRunner;
