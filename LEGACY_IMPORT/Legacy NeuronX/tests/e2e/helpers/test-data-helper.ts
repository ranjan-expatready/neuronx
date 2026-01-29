import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test data helper for managing fixtures and test data
 */
export class TestDataHelper {
  private static fixturesPath = path.join(__dirname, '..', 'fixtures');

  /**
   * Load fixture data from JSON file
   */
  static loadFixture<T>(filename: string): T {
    const filePath = path.join(this.fixturesPath, filename);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data) as T;
  }

  /**
   * Save fixture data to JSON file
   */
  static saveFixture(filename: string, data: any): void {
    const filePath = path.join(this.fixturesPath, filename);
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonData, 'utf8');
  }

  /**
   * Get sample lead data
   */
  static getSampleLead(overrides: Partial<any> = {}) {
    return {
      id: `lead-${Date.now()}`,
      firstName: 'Test',
      lastName: 'User',
      email: `test.${Date.now()}@example.com`,
      phone: '+1234567890',
      company: 'Test Company',
      industry: 'technology',
      companySize: 50,
      tenantId: 'test-tenant-1',
      ...overrides,
    };
  }

  /**
   * Get sample tenant data
   */
  static getSampleTenant(overrides: Partial<any> = {}) {
    return {
      id: `tenant-${Date.now()}`,
      name: 'Test Tenant',
      domain: `test${Date.now()}.neuronx.com`,
      status: 'active',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Get sample GHL webhook payload
   */
  static getSampleGHLWebhook(overrides: Partial<any> = {}) {
    return {
      id: `webhook-${Date.now()}`,
      tenantId: 'test-tenant-1',
      type: 'contact.created',
      timestamp: new Date().toISOString(),
      payload: {
        contact: {
          id: `ghl-contact-${Date.now()}`,
          firstName: 'Webhook',
          lastName: 'Test',
          email: `webhook.${Date.now()}@test.com`,
          phone: '+1987654321',
          companyName: 'Webhook Corp',
          tags: ['test-lead', 'automated'],
          customFields: {
            industry: 'technology',
            companySize: '51-200',
            budget: '25000',
          },
        },
      },
      ...overrides,
    };
  }

  /**
   * Get sample conversation data
   */
  static getSampleConversation(leadId: string, overrides: Partial<any> = {}) {
    return {
      id: `conv-${Date.now()}`,
      leadId,
      tenantId: 'test-tenant-1',
      messages: [
        {
          id: `msg-1-${Date.now()}`,
          content: "Hi, I'm interested in your enterprise solution.",
          sender: 'lead',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          sentiment: 0.8,
        },
        {
          id: `msg-2-${Date.now()}`,
          content: 'We have 150 employees and need scalability.',
          sender: 'lead',
          timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
          sentiment: 0.7,
        },
      ],
      summary: {
        sentiment: 0.75,
        topic: 'enterprise_solution_inquiry',
        urgency: 'medium',
      },
      ...overrides,
    };
  }

  /**
   * Get sample AI scoring result
   */
  static getSampleAIScoring(leadId: string, overrides: Partial<any> = {}) {
    return {
      leadId,
      tenantId: 'test-tenant-1',
      originalScore: 75,
      enhancedScore: 88,
      adjustment: 13,
      confidence: 0.85,
      factors: {
        baseScore: { value: 75 / 100, weight: 0.4, contribution: 0.3 },
        sentimentScore: { value: 0.8, weight: 0.25, contribution: 0.2 },
        timingScore: { value: 0.9, weight: 0.15, contribution: 0.135 },
        frequencyScore: { value: 0.6, weight: 0.15, contribution: 0.09 },
        industryAdjustment: { value: 1.1, weight: 0, contribution: 0.1 },
      },
      reasoning: [
        'Original score: 75',
        'Strong positive sentiment (+20 points)',
        'Fast response time (+13.5 points)',
        'Industry adjustment: score boosted by 10%',
      ],
      cipherDecision: {
        allowed: true,
        action: 'allow',
        reason: 'All checks passed',
        confidence: 0.95,
        mode: 'monitor',
      },
      ...overrides,
    };
  }

  /**
   * Get sample routing recommendation
   */
  static getSampleRoutingRecommendation(
    leadId: string,
    overrides: Partial<any> = {}
  ) {
    return {
      leadId,
      tenantId: 'test-tenant-1',
      recommendedTeam: {
        teamId: 'team-enterprise',
        name: 'Enterprise Solutions',
        industryExpertise: ['technology', 'healthcare', 'finance'],
        performanceScore: 0.92,
        currentLoad: 8,
        capacityLimit: 15,
        regions: ['north-america', 'europe'],
      },
      confidence: 0.88,
      reasoning: [
        'Recommended team: Enterprise Solutions (team-enterprise)',
        'Strong industry expertise in technology',
        'High-performing team (92% success rate)',
        'Good capacity availability (53% loaded)',
        'Perfect geographic match for north-america',
      ],
      alternatives: [
        {
          team: {
            teamId: 'team-startup',
            name: 'Startup Specialists',
            industryExpertise: ['technology', 'retail'],
            performanceScore: 0.88,
          },
          score: 0.82,
          reason: 'Good alternative with industry expertise',
        },
      ],
      factors: {
        scoreMatch: { value: 0.88, weight: 0.25, contribution: 0.22 },
        industryMatch: { value: 1.0, weight: 0.25, contribution: 0.25 },
        performanceMatch: { value: 0.92, weight: 0.2, contribution: 0.184 },
        capacityMatch: { value: 0.53, weight: 0.15, contribution: 0.0795 },
        geographicMatch: { value: 1.0, weight: 0.15, contribution: 0.15 },
      },
      cipherDecision: {
        allowed: true,
        action: 'allow',
        reason: 'Routing recommendation approved',
        confidence: 0.91,
        mode: 'monitor',
      },
      ...overrides,
    };
  }

  /**
   * Validate fixture integrity
   */
  static validateFixtures(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check if fixtures directory exists
      if (!fs.existsSync(this.fixturesPath)) {
        errors.push('Fixtures directory does not exist');
        return { valid: false, errors };
      }

      // Check for required fixture files
      const requiredFixtures = [
        'neuronx/sample-lead.json',
        'neuronx/sample-tenant.json',
        'ghl/sample-webhook.json',
      ];

      for (const fixture of requiredFixtures) {
        const fixturePath = path.join(this.fixturesPath, fixture);
        if (!fs.existsSync(fixturePath)) {
          errors.push(`Required fixture missing: ${fixture}`);
        } else {
          // Validate JSON syntax
          try {
            JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
          } catch (error) {
            errors.push(
              `Invalid JSON in fixture: ${fixture} - ${error.message}`
            );
          }
        }
      }
    } catch (error) {
      errors.push(`Fixture validation error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Regenerate sample fixtures
   */
  static regenerateFixtures(): void {
    // Create sample fixtures
    this.saveFixture('neuronx/sample-lead.json', this.getSampleLead());
    this.saveFixture('neuronx/sample-tenant.json', this.getSampleTenant());
    this.saveFixture('ghl/sample-webhook.json', this.getSampleGHLWebhook());
    this.saveFixture(
      'neuronx/sample-conversation.json',
      this.getSampleConversation('sample-lead-id')
    );
    this.saveFixture(
      'neuronx/sample-ai-scoring.json',
      this.getSampleAIScoring('sample-lead-id')
    );
    this.saveFixture(
      'neuronx/sample-routing.json',
      this.getSampleRoutingRecommendation('sample-lead-id')
    );

    console.log('✅ Sample fixtures regenerated');
  }
}
