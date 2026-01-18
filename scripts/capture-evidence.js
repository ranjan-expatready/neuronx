#!/usr/bin/env node

/**
 * Evidence Capture System for NeuronX Testing
 *
 * Captures comprehensive evidence from all test runs including:
 * - Screenshots, videos, and traces from E2E tests
 * - Coverage reports and performance metrics from unit tests
 * - API response logs from integration tests
 * - Load test results and performance benchmarks
 * - Security scan results and compliance checks
 *
 * Usage: node scripts/capture-evidence.js [test-type] [run-id]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_TYPES = {
  UNIT: 'unit',
  INTEGRATION: 'integration',
  E2E: 'e2e',
  API: 'api',
  LOAD: 'load',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
};

const EVIDENCE_DIR = path.join(__dirname, '..', 'docs', 'EVIDENCE');

// Ensure evidence directory exists
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

class EvidenceCapture {
  constructor(testType, runId = null) {
    this.testType = testType;
    this.runId = runId || this.generateRunId();
    this.timestamp = new Date().toISOString();
    this.evidencePath = path.join(EVIDENCE_DIR, this.testType);
    this.runPath = path.join(this.evidencePath, this.runId);

    // Create directories
    if (!fs.existsSync(this.evidencePath)) {
      fs.mkdirSync(this.evidencePath, { recursive: true });
    }
    if (!fs.existsSync(this.runPath)) {
      fs.mkdirSync(this.runPath, { recursive: true });
    }
  }

  generateRunId() {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async captureUnitTestEvidence(coverageData, testResults) {
    const evidence = {
      type: 'unit_test_evidence',
      runId: this.runId,
      timestamp: this.timestamp,
      coverage: {
        total: coverageData.total,
        functions: coverageData.functions,
        branches: coverageData.branches,
        lines: coverageData.lines,
        statements: coverageData.statements,
      },
      results: {
        totalTests: testResults.numTotalTests,
        passedTests: testResults.numPassedTests,
        failedTests: testResults.numFailedTests,
        duration: testResults.duration,
        coverageThreshold: '>=85%',
      },
      files: testResults.testResults.map(result => ({
        file: result.testFilePath,
        tests: result.numPassingTests + result.numFailingTests,
        passed: result.numPassingTests,
        failed: result.numFailingTests,
        duration: result.perfStats.runtime,
      })),
    };

    this.saveEvidence('unit_test_results.json', evidence);
    this.generateCoverageReport(coverageData);

    return evidence;
  }

  async captureE2ETestEvidence(
    playwrightResults,
    screenshots = [],
    videos = [],
    traces = []
  ) {
    const evidence = {
      type: 'e2e_test_evidence',
      runId: this.runId,
      timestamp: this.timestamp,
      framework: 'playwright',
      results: {
        totalTests: playwrightResults.total,
        passedTests: playwrightResults.passed,
        failedTests: playwrightResults.failed,
        skippedTests: playwrightResults.skipped,
        duration: playwrightResults.duration,
        browsers: playwrightResults.browsers || ['chromium'],
      },
      artifacts: {
        screenshots: screenshots.map(s => path.basename(s)),
        videos: videos.map(v => path.basename(v)),
        traces: traces.map(t => path.basename(t)),
      },
      testDetails: playwrightResults.suites?.map(suite => ({
        title: suite.title,
        tests: suite.tests?.map(test => ({
          title: test.title,
          status: test.status,
          duration: test.duration,
          error: test.error?.message,
        })),
      })),
    };

    this.saveEvidence('e2e_test_results.json', evidence);

    // Copy artifacts to evidence directory
    await this.copyArtifacts(screenshots, 'screenshots');
    await this.copyArtifacts(videos, 'videos');
    await this.copyArtifacts(traces, 'traces');

    return evidence;
  }

  async captureAPITestEvidence(newmanResults) {
    const evidence = {
      type: 'api_test_evidence',
      runId: this.runId,
      timestamp: this.timestamp,
      framework: 'postman_newman',
      collection: newmanResults.collection.name,
      environment: newmanResults.environment?.name,
      results: {
        totalRequests: newmanResults.run.stats.requests.total,
        failedRequests: newmanResults.run.stats.requests.failed,
        totalAssertions: newmanResults.run.stats.assertions.total,
        failedAssertions: newmanResults.run.stats.assertions.failed,
        responseTime: {
          average: Math.round(newmanResults.run.timings.responseAverage),
          min: newmanResults.run.timings.responseMin,
          max: newmanResults.run.timings.responseMax,
        },
      },
      requests: newmanResults.run.executions.map(exec => ({
        name: exec.item.name,
        method: exec.request.method,
        url: exec.request.url.toString(),
        responseTime: exec.response.responseTime,
        status: exec.response.status,
        statusText: exec.response.statusText,
        tests: exec.assertions?.map(assertion => ({
          name: assertion.assertion,
          passed: !assertion.error,
          error: assertion.error?.message,
        })),
      })),
    };

    this.saveEvidence('api_test_results.json', evidence);
    return evidence;
  }

  async captureLoadTestEvidence(loadResults) {
    const evidence = {
      type: 'load_test_evidence',
      runId: this.runId,
      timestamp: this.timestamp,
      configuration: loadResults.configuration,
      execution: loadResults.execution,
      performance: loadResults.performance,
      systemResources: loadResults.systemResources,
      cipherMonitoring: loadResults.cipherMonitoring,
      recommendations: this.generateLoadRecommendations(loadResults),
    };

    this.saveEvidence('load_test_results.json', evidence);
    this.generateLoadReport(loadResults);

    return evidence;
  }

  async captureSecurityTestEvidence(securityResults) {
    const evidence = {
      type: 'security_test_evidence',
      runId: this.runId,
      timestamp: this.timestamp,
      scanner: securityResults.scanner || 'custom',
      results: {
        totalChecks: securityResults.totalChecks,
        passedChecks: securityResults.passedChecks,
        failedChecks: securityResults.failedChecks,
        criticalFindings: securityResults.criticalFindings || 0,
        highFindings: securityResults.highFindings || 0,
        mediumFindings: securityResults.mediumFindings || 0,
        lowFindings: securityResults.lowFindings || 0,
      },
      vulnerabilities: securityResults.vulnerabilities?.map(vuln => ({
        severity: vuln.severity,
        title: vuln.title,
        description: vuln.description,
        cwe: vuln.cwe,
        owasp: vuln.owasp,
        remediation: vuln.remediation,
      })),
      compliance: securityResults.compliance || {},
    };

    this.saveEvidence('security_test_results.json', evidence);
    this.generateSecurityReport(securityResults);

    return evidence;
  }

  generateCoverageReport(coverageData) {
    const report = `# Unit Test Coverage Report
**Run ID:** ${this.runId}
**Timestamp:** ${this.timestamp}

## Coverage Summary
- **Total Coverage:** ${coverageData.total || 'N/A'}%
- **Functions:** ${coverageData.functions || 'N/A'}%
- **Branches:** ${coverageData.branches || 'N/A'}%
- **Lines:** ${coverageData.lines || 'N/A'}%
- **Statements:** ${coverageData.statements || 'N/A'}%

## Threshold Status
${this.checkCoverageThreshold(coverageData) ? '✅ PASSED: Coverage meets >=85% threshold' : '❌ FAILED: Coverage below 85% threshold'}

## Recommendations
${this.generateCoverageRecommendations(coverageData)}
`;

    this.saveEvidence('coverage_report.md', report);
  }

  generateLoadReport(loadResults) {
    const report = `# Load Test Performance Report
**Run ID:** ${this.runId}
**Timestamp:** ${this.timestamp}

## Test Configuration
- Leads per minute: ${loadResults.configuration?.leadsPerMinute || 'N/A'}
- Duration: ${loadResults.configuration?.durationMinutes || 'N/A'} minutes
- Total leads: ${loadResults.configuration?.totalExpectedLeads || 'N/A'}

## Performance Results

### Pipeline Latency (P95)
- Enhanced Scoring: ${loadResults.performance?.enhancedScoring?.percentiles?.p95 || 'N/A'}ms
- Predictive Routing: ${loadResults.performance?.predictiveRouting?.percentiles?.p95 || 'N/A'}ms
- Total Pipeline: ${loadResults.performance?.totalPipeline?.percentiles?.p95 || 'N/A'}ms

### System Resources
- Peak Memory: ${loadResults.systemResources?.peakMemoryUsage ? (loadResults.systemResources.peakMemoryUsage / 1024 / 1024).toFixed(1) + 'MB' : 'N/A'}
- Memory Samples: ${loadResults.systemResources?.memorySamples || 'N/A'}

## Cipher Monitoring
- Total Decisions: ${loadResults.cipherMonitoring?.totalDecisions || 'N/A'}
- Anomalies Detected: ${loadResults.cipherMonitoring?.anomaliesDetected || 'N/A'}

## Threshold Assessment
${this.generateLoadThresholdAssessment(loadResults)}
`;

    this.saveEvidence('load_performance_report.md', report);
  }

  generateSecurityReport(securityResults) {
    const report = `# Security Test Report
**Run ID:** ${this.runId}
**Timestamp:** ${this.timestamp}

## Executive Summary
- **Total Checks:** ${securityResults.totalChecks || 0}
- **Passed:** ${securityResults.passedChecks || 0}
- **Failed:** ${securityResults.failedChecks || 0}
- **Critical Findings:** ${securityResults.criticalFindings || 0}
- **High Findings:** ${securityResults.highFindings || 0}

## Risk Assessment
${this.generateSecurityRiskAssessment(securityResults)}

## Recommendations
${this.generateSecurityRecommendations(securityResults)}
`;

    this.saveEvidence('security_assessment_report.md', report);
  }

  checkCoverageThreshold(coverageData) {
    const totalCoverage = parseFloat(coverageData.total || '0');
    return totalCoverage >= 85;
  }

  generateCoverageRecommendations(coverageData) {
    const recommendations = [];

    if (parseFloat(coverageData.lines || '0') < 85) {
      recommendations.push(
        '- Increase line coverage by adding more test scenarios'
      );
    }
    if (parseFloat(coverageData.branches || '0') < 85) {
      recommendations.push(
        '- Add tests for conditional branches and error paths'
      );
    }
    if (parseFloat(coverageData.functions || '0') < 85) {
      recommendations.push('- Test all exported functions and methods');
    }

    return recommendations.length > 0
      ? recommendations.join('\n')
      : '- Coverage meets all thresholds ✅';
  }

  generateLoadThresholdAssessment(loadResults) {
    const assessments = [];
    const p95Pipeline =
      loadResults.performance?.totalPipeline?.percentiles?.p95 || 0;

    if (p95Pipeline > 500) {
      assessments.push(
        '❌ P95 Pipeline Latency exceeds 500ms threshold - requires optimization'
      );
    } else if (p95Pipeline > 300) {
      assessments.push(
        '⚠️ P95 Pipeline Latency above 300ms - monitor for degradation'
      );
    } else {
      assessments.push('✅ P95 Pipeline Latency within acceptable range');
    }

    const successRate = parseFloat(loadResults.execution?.successRate || '0');
    if (successRate < 99.5) {
      assessments.push(
        '❌ Success rate below 99.5% threshold - investigate failures'
      );
    } else {
      assessments.push('✅ Success rate meets 99.5%+ threshold');
    }

    return assessments.join('\n');
  }

  generateLoadRecommendations(loadResults) {
    const recommendations = [];

    const p95Pipeline =
      loadResults.performance?.totalPipeline?.percentiles?.p95 || 0;
    if (p95Pipeline > 500) {
      recommendations.push({
        priority: 'HIGH',
        category: 'PERFORMANCE',
        recommendation:
          'Optimize AI pipeline latency - consider caching, async processing, or horizontal scaling',
        impact: 'Improve user experience and system throughput',
      });
    }

    const throughput = parseFloat(loadResults.execution?.throughput || '0');
    if (throughput < 10) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'SCALABILITY',
        recommendation:
          'Increase processing capacity - optimize database queries or add worker processes',
        impact: 'Support higher transaction volumes',
      });
    }

    return recommendations;
  }

  generateSecurityRiskAssessment(securityResults) {
    const critical = securityResults.criticalFindings || 0;
    const high = securityResults.highFindings || 0;

    if (critical > 0) {
      return '🔴 CRITICAL RISK: Critical security vulnerabilities detected. Immediate remediation required.';
    } else if (high > 2) {
      return '🟠 HIGH RISK: Multiple high-severity findings. Address within 30 days.';
    } else if (high > 0) {
      return '🟡 MEDIUM RISK: High-severity findings present. Address within 90 days.';
    } else {
      return '🟢 LOW RISK: No critical or high-severity findings detected.';
    }
  }

  generateSecurityRecommendations(securityResults) {
    const recommendations = [];

    if ((securityResults.criticalFindings || 0) > 0) {
      recommendations.push(
        '- **URGENT**: Address all critical security findings immediately'
      );
    }

    if ((securityResults.highFindings || 0) > 0) {
      recommendations.push(
        '- Review and remediate high-severity security issues'
      );
    }

    recommendations.push(
      '- Implement regular security scanning in CI/CD pipeline'
    );
    recommendations.push(
      '- Review access controls and authentication mechanisms'
    );
    recommendations.push('- Ensure proper input validation and sanitization');

    return recommendations.join('\n');
  }

  async copyArtifacts(artifacts, subdir) {
    const artifactDir = path.join(this.runPath, subdir);
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    for (const artifact of artifacts) {
      if (fs.existsSync(artifact)) {
        const dest = path.join(artifactDir, path.basename(artifact));
        fs.copyFileSync(artifact, dest);
      }
    }
  }

  saveEvidence(filename, data) {
    const filePath = path.join(this.runPath, filename);
    const content =
      typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content);
    console.log(`📄 Evidence saved: ${filePath}`);
  }

  getEvidenceSummary() {
    const summary = {
      runId: this.runId,
      testType: this.testType,
      timestamp: this.timestamp,
      evidencePath: this.runPath,
      files: [],
    };

    if (fs.existsSync(this.runPath)) {
      summary.files = fs.readdirSync(this.runPath).map(file => ({
        name: file,
        path: path.join(this.runPath, file),
        size: fs.statSync(path.join(this.runPath, file)).size,
      }));
    }

    return summary;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || TEST_TYPES.UNIT;
  const runId = args[1];

  const capture = new EvidenceCapture(testType, runId);

  console.log(`🎯 Starting evidence capture for ${testType} tests`);
  console.log(`📁 Evidence will be saved to: ${capture.runPath}`);

  // In a real implementation, this would be called from test runners
  // For now, just create the evidence structure
  const summary = capture.getEvidenceSummary();

  console.log('📊 Evidence Summary:', JSON.stringify(summary, null, 2));
}

export default EvidenceCapture;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
