# Test Fixtures Documentation

## Overview

Test fixtures provide deterministic, reusable test data for all testing layers (unit, integration, E2E). This document describes the fixture management system, usage guidelines, and maintenance procedures.

## Fixture Structure

```
tests/e2e/fixtures/
├── neuronx/           # NeuronX domain objects
│   ├── sample-lead.json
│   ├── sample-tenant.json
│   ├── sample-conversation.json
│   ├── sample-ai-scoring.json
│   └── sample-routing.json
└── ghl/               # External provider fixtures
    ├── sample-webhook.json
    └── sample-contact.json
```

## Core Fixtures

### NeuronX Domain Fixtures

#### Lead Fixture (`neuronx/sample-lead.json`)

```json
{
  "id": "test-lead-001",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "company": "TechCorp",
  "industry": "technology",
  "companySize": 150,
  "tenantId": "test-tenant-1"
}
```

**Usage:**

- Unit tests for lead processing logic
- Integration tests for lead creation workflows
- E2E tests for lead management UI

#### Tenant Fixture (`neuronx/sample-tenant.json`)

```json
{
  "id": "test-tenant-1",
  "name": "Test Tenant",
  "domain": "test.neuronx.com",
  "status": "active"
}
```

**Usage:**

- Multi-tenant isolation testing
- Tenant-specific feature validation
- Security boundary testing

#### Conversation Fixture (`neuronx/sample-conversation.json`)

```json
{
  "id": "conv-test-001",
  "leadId": "test-lead-001",
  "tenantId": "test-tenant-1",
  "messages": [
    {
      "content": "Interested in your enterprise solution",
      "sentiment": 0.8,
      "timestamp": "2024-01-01T10:00:00Z"
    }
  ],
  "summary": {
    "sentiment": 0.8,
    "topic": "enterprise_inquiry"
  }
}
```

**Usage:**

- Conversation analysis testing
- Sentiment scoring validation
- AI conversation processing

#### AI Scoring Fixture (`neuronx/sample-ai-scoring.json`)

```json
{
  "leadId": "test-lead-001",
  "originalScore": 75,
  "enhancedScore": 88,
  "adjustment": 13,
  "confidence": 0.85,
  "factors": {
    "sentimentScore": { "value": 0.8, "weight": 0.25, "contribution": 0.2 },
    "timingScore": { "value": 0.9, "weight": 0.15, "contribution": 0.135 }
  },
  "reasoning": [
    "Strong positive sentiment (+20 points)",
    "Fast response time (+13.5 points)"
  ]
}
```

**Usage:**

- AI scoring algorithm validation
- Multi-signal analysis testing
- Cipher safety monitoring

#### Routing Fixture (`neuronx/sample-routing.json`)

```json
{
  "leadId": "test-lead-001",
  "recommendedTeam": {
    "teamId": "team-enterprise",
    "name": "Enterprise Solutions",
    "industryExpertise": ["technology", "healthcare"]
  },
  "confidence": 0.88,
  "reasoning": ["Strong industry expertise match", "High performance history"],
  "alternatives": [
    {
      "team": { "teamId": "team-startup", "name": "Startup Specialists" },
      "score": 0.82,
      "reason": "Good alternative with industry expertise"
    }
  ]
}
```

**Usage:**

- Routing algorithm testing
- Team recommendation validation
- Capacity planning testing

### External Provider Fixtures

#### GHL Webhook Fixture (`ghl/sample-webhook.json`)

```json
{
  "id": "ghl-webhook-001",
  "tenantId": "test-tenant-1",
  "type": "contact.created",
  "payload": {
    "contact": {
      "id": "ghl-contact-123",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@ghl-example.com",
      "customFields": {
        "industry": "Technology",
        "companySize": "100-500"
      }
    }
  }
}
```

**Usage:**

- Webhook processing testing
- Data transformation validation
- Signature verification testing

## Fixture Management

### TestDataHelper Class

The `TestDataHelper` class provides programmatic access to fixtures:

```typescript
import { TestDataHelper } from '../helpers/test-data-helper';

// Load fixture data
const leadData = TestDataHelper.loadFixture('neuronx/sample-lead.json');

// Generate dynamic test data
const customLead = TestDataHelper.getSampleLead({
  firstName: 'Custom',
  industry: 'finance',
});

// Validate all fixtures
const validation = TestDataHelper.validateFixtures();
if (!validation.valid) {
  console.error('Fixture validation failed:', validation.errors);
}
```

### Fixture Validation

Run fixture validation before committing changes:

```bash
# Validate all fixtures
node scripts/validate-fixtures.js

# Exit code 0 = valid, 1 = invalid
echo $?  # Check exit code
```

### CI Integration

Fixtures are validated in CI pipelines:

```yaml
- name: Validate Fixtures
  run: node scripts/validate-fixtures.js

- name: Fail on Invalid Fixtures
  run: |
    if [ $? -ne 0 ]; then
      echo "Fixture validation failed"
      exit 1
    fi
```

## Usage Guidelines

### When to Use Fixtures

**✅ Use Fixtures For:**

- Deterministic test data
- Complex object relationships
- External API response mocking
- Multi-step workflow testing
- Performance benchmarking

**❌ Don't Use Fixtures For:**

- Simple primitive values
- Randomly generated test data
- One-off test scenarios
- Dynamic configuration

### Fixture Creation

**1. Identify the Need**

- Determine what domain object or data structure is needed
- Check if similar fixtures already exist

**2. Create the Fixture**

```bash
# Use TestDataHelper to generate base fixture
node -e "
const { TestDataHelper } = require('./tests/e2e/helpers/test-data-helper');
const data = TestDataHelper.getSampleLead({ industry: 'healthcare' });
TestDataHelper.saveFixture('neuronx/healthcare-lead.json', data);
"
```

**3. Validate the Fixture**

```bash
node scripts/validate-fixtures.js
```

**4. Update Documentation**

- Add fixture to this document
- Update any cross-references
- Document usage scenarios

### Fixture Maintenance

**Regular Tasks:**

- Run validation before commits
- Update fixtures when domain models change
- Remove obsolete fixtures
- Regenerate sample data periodically

**Schema Updates:**
When domain models change, update fixture schemas:

1. Modify `scripts/validate-fixtures.js` schemas
2. Update existing fixtures to match new schema
3. Run validation to ensure compliance

## Cross-References

Fixtures maintain referential integrity:

- **Conversations** reference **Leads** by `leadId`
- **AI Scoring** references **Leads** by `leadId`
- **Routing** references **Leads** by `leadId`
- **Webhooks** may reference **Contacts** from external providers

Validation scripts check these relationships automatically.

## Security Considerations

**Sensitive Data Handling:**

- Fixtures contain test data only
- No real customer information
- No production secrets or credentials
- Use environment variables for secrets in tests

**Data Sanitization:**

- Email addresses use `@example.com` domain
- Phone numbers use test prefixes
- Company names are fictional
- Personal data is anonymized

## Performance Impact

**Fixture Loading:**

- JSON parsing is fast (< 1ms per fixture)
- Cached fixtures reduce I/O
- Validation runs in < 100ms for full suite

**Test Execution:**

- Fixtures provide consistent baseline
- Reduce test flakiness
- Enable reliable performance comparisons

## Troubleshooting

### Common Issues

**"Fixture not found"**

- Check file path and naming
- Ensure fixture exists in correct location
- Run `find tests/e2e/fixtures -name "*.json"` to list all fixtures

**"Schema validation failed"**

- Check fixture JSON syntax
- Verify required fields are present
- Update schema if domain model changed
- Run `node scripts/validate-fixtures.js` for detailed errors

**"Cross-reference error"**

- Check that referenced entities exist
- Verify ID consistency across fixtures
- Update references when IDs change

### Getting Help

- Run `node scripts/validate-fixtures.js` for automated diagnosis
- Check fixture validation reports in `docs/EVIDENCE/`
- Review this documentation for usage examples
- Consult team for domain-specific fixture questions

## Maintenance Ownership

**Primary Owner:** Test Engineering Team
**Secondary Owner:** Development Team (fixture consumers)

**Responsibilities:**

- Keep fixtures up-to-date with domain models
- Maintain validation scripts and schemas
- Ensure cross-reference integrity
- Monitor fixture usage and effectiveness

**Review Cycle:** Monthly fixture audit and cleanup
