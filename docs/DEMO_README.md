# NeuronX Phase 4A Demo Pack

## Overview

This demo showcases NeuronX's core value proposition: **Automated lead intelligence and sales orchestration**. In under 2 minutes, you'll see a raw lead transformed into a qualified sales opportunity with full audit trail and business intelligence.

**Demo Flow:** Raw Lead → AI Scoring → Qualification → Opportunity Creation → Audit Trail

**No UI Required** - Pure API demonstration using existing fixtures and event-driven architecture.

## Quick Start

```bash
# Run the complete demo (requires NeuronX core-api running)
./scripts/demo/run_demo.sh
```

**Expected Output:**

```
🚀 NEURONX DEMO: Lead Intelligence & Sales Orchestration
======================================================

📥 INPUT: Raw Lead Data
   Lead ID: demo-contact-001
   Name: Sarah Johnson (Tech Corp)
   Industry: technology
   Company Size: 150

🤖 AI SCORING: 82 points
   Industry Match: +24 (technology priority)
   Company Size: +18 (150 employees)
   Lead Quality: High

✅ QUALIFICATION: PASSED
   Threshold: 70 points
   Qualified: Yes
   Reason: Meets all criteria

💼 OPPORTUNITY: Created
   Opportunity ID: opp-demo-789
   Stage: qualification
   Value Estimate: $8,200
   Contact: Sarah Johnson

📊 AUDIT TRAIL: Complete
   Events: 3 emitted
   Correlation ID: demo-2026-01-03
   Processing Time: 1.2s

🎯 RESULT: Lead converted to sales opportunity in 90 seconds
```

## Prerequisites

1. **NeuronX Core API Running**

   ```bash
   cd apps/core-api
   pnpm run start:dev
   ```

2. **Database Available** (Prisma migrations applied)

3. **Environment Variables** (optional for local demo)
   - `NEURONX_ENV=dev` (enables verbose logging)
   - `BASE_URL=http://localhost:3000` (for webhook simulation)

## Demo Scenarios

### Primary Scenario: Lead → Opportunity (2 minutes)

**What it proves:** Complete lead intelligence pipeline from raw data to sales-ready opportunity.

**Flow:**

1. Raw lead ingested via webhook
2. AI scoring engine evaluates lead quality
3. Qualification rules applied (industry, size, requirements)
4. Opportunity automatically created in CRM
5. Full audit trail captured

**Business Value:** Eliminates manual lead qualification, ensures no high-value leads slip through cracks.

### Alternative Scenarios

#### SLA Escalation Demo

```bash
./scripts/demo/run_demo.sh --scenario=sla
```

**Flow:** Qualified lead → SLA timer starts → Breach triggers → Escalation action

#### Conversation Intelligence Demo

```bash
./scripts/demo/run_demo.sh --scenario=conversation
```

**Flow:** Inbound message → Signal analysis → Lead rescoring → Routing adjustment

## Detailed Walkthrough

### Step 1: Environment Setup

The demo script automatically:

- Verifies NeuronX core-api is running
- Sets demo-specific environment variables
- Prepares test fixtures

### Step 2: Lead Ingestion

```bash
# Simulated webhook payload sent to NeuronX
POST /integrations/ghl/webhooks
{
  "leadId": "demo-contact-001",
  "contact": {
    "name": "Sarah Johnson",
    "email": "sarah@techcorp.com",
    "phone": "+1-555-0123"
  },
  "company": {
    "name": "Tech Corp",
    "industry": "technology",
    "size": 150
  }
}
```

### Step 3: AI Scoring Engine

- **Industry Analysis:** Technology sector gets +20% boost
- **Company Size Scoring:** 150 employees = high value
- **Lead Quality:** Complete contact info, engaged signals
- **Total Score:** 82/100 (High priority)

### Step 4: Qualification Rules

- **Email Required:** ✅ Present
- **Phone Required:** ❌ Not required by config
- **Company Size Min:** 150 > 10 ✅
- **Industry Priority:** Technology ×1.2 multiplier applied
- **Threshold Check:** 82 > 70 ✅ QUALIFIED

### Step 5: Opportunity Creation

- **CRM Integration:** Opportunity created via adapter contract
- **Data Mapping:** Lead info transferred to opportunity fields
- **Stage Assignment:** "qualification" (initial stage)
- **Value Estimation:** $8,200 based on score × $100 multiplier

### Step 6: Audit & Reporting

- **Event Emission:** 3 events captured (scored, qualified, opportunity_created)
- **Correlation Tracking:** Full request tracing with demo-2026-01-03
- **Performance Metrics:** Processing time, success rates
- **Explainability:** Complete reasoning for each decision

## Configuration Used

```json
{
  "qualification": {
    "threshold": 70,
    "rules": {
      "requireEmail": true,
      "industryPriority": { "technology": 1.2 }
    }
  },
  "scoring": {
    "weights": {
      "industry": 0.3,
      "companySize": 0.3,
      "engagement": 0.4
    }
  }
}
```

## Troubleshooting

### Demo Fails to Run

- Ensure `apps/core-api` is running on port 3000
- Check database connectivity
- Verify no firewall blocking localhost

### Unexpected Scores/Routing

- Demo uses deterministic fixtures
- Check if custom config overrides default values
- Reset to default config for consistent results

### Missing Opportunities

- Verify adapter configuration
- Check CRM connection status
- Review adapter contract implementation

## Evidence & Validation

All demo runs are automatically logged to:

- `docs/EVIDENCE/demo_output.txt` - Complete execution log
- `docs/EVIDENCE/demo_commands.txt` - API calls made
- Core API logs with correlation ID tracing

## Next Steps

After running the demo:

1. **Customize Configuration** - Adjust qualification rules, scoring weights
2. **Extend Scenarios** - Add your own demo workflows
3. **Production Deployment** - Use same patterns for live implementation
4. **Phase 4B** - Build additional vertical slices

## Technical Notes

- **Event-Driven:** All processing happens through event bus
- **Adapter Contracts:** Uses ICRMAdapter for CRM operations
- **Configuration-Driven:** Business rules from control plane
- **Test Fixtures:** Deterministic data for consistent results
- **Audit Trail:** Complete observability of all decisions

---

**Ready to see NeuronX in action?** Run `./scripts/demo/run_demo.sh` and watch intelligent sales orchestration happen automatically! 🚀
