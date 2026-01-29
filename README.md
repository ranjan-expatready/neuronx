# Autonomous Engineering OS

A self-governing, self-documenting AI engineering organization designed for solo non-technical founders to build SaaS products.

## Overview

This repository is a reusable framework and operating system for autonomous software development. It encodes engineering best practices, governance rules, agent responsibilities, and decision-making processes so that an AI system can understand itself on every restart and operate autonomously with human-in-the-loop governance.

## What This Is

- **Not** a specific software product
- **Yes** a template/framework for building products
- **Not** just documentation — it's executable doctrine
- **Yes** a complete engineering organization structure

## Quick Start

### As a Template for New Products

1. Clone this repository
2. Customize the structure for your product
3. Populate `PRODUCT/` with your product requirements
4. Use `APP/` for your actual application code
5. The framework guides autonomous development

### Understanding the Framework

The framework is organized into key areas:

- **GOVERNANCE/**: Rules, guardrails, risk tiers, cost policy, definition of done
- **AGENTS/**: Agent roles, contracts, best practices, prompt templates
- **FRAMEWORK_KNOWLEDGE/**: Autonomy principles, product practices, engineering standards, testing strategy, deployment philosophy
- **ARCHITECTURE/**: Your product's architecture (to be filled)
- **RUNBOOKS/**: Operational runbooks (to be filled)
- **BACKLOG/**: Product backlog and work items (to be filled)
- **PRODUCT/**: Product requirements, user stories (to be filled)
- **APP/**: Application code that you build

## Folder Structure

```
.
├── FRAMEWORK_REQUIREMENTS.md       # Core system requirements and state machine
├── GOVERNANCE/                      # Rules and guardrails
│   ├── GUARDRAILS.md               # One-writer rule, approval gates, safe terminal
│   ├── DEFINITION_OF_DONE.md       # When work is considered complete
│   ├── RISK_TIERS.md               # Risk classification system
│   └── COST_POLICY.md              # Cost management and thresholds
├── AGENTS/                          # Agent definitions and contracts
│   ├── ROLES.md                    # Product, Code, Reliability, Knowledge, Advisor
│   ├── CONTRACTS.md                # Contracts for each agent and task type
│   ├── BEST_PRACTICES.md           # 50+ best practices for agents
│   └── PROMPT_TEMPLATES.md         # Reusable prompt templates
├── FRAMEWORK_KNOWLEDGE/             # Engineered knowledge base
│   ├── autonomy_principles.md      # How autonomous operation works
│   ├── product_best_practices.md   # Product development principles
│   ├── engineering_standards.md    # Code quality standards
│   ├── testing_strategy.md         # Comprehensive testing approach
│   └── deployment_philosophy.md    # Safe deployment practices
├── ARCHITECTURE/                    # Your product architecture (fill this)
├── RUNBOOKS/                        # Operational runbooks (fill this)
├── BACKLOG/                         # Product backlog items (fill this)
├── PRODUCT/                         # Product requirements (fill this)
├── APP/                            # Your application code (fill this)
├── .github/workflows/               # CI/CD automation
│   ├── ci.yml                      # Continuous integration
│   └── release.yml                 # Release workflow
└── README.md                       # This file
```

## Core Concepts

### One-Writer Rule

Only Factory (this system) writes to the repository. External AIs (ChatGPT, Claude, etc.) function in advisors-only capacity.

### State Machine

The system operates as a deterministic state machine:
```
IDLE → PLANNING → EXECUTING → WAITING_FOR_HUMAN
```

The system stops only at explicit gates: ambiguity, cost thresholds, production deployment, security risk.

### Risk Tiers

| Tier | Name | Autonomy | Approval |
|------|------|----------|----------|
| T1 | Critical | None | Always required |
| T2 | High | Limited | Required for gates |
| T3 | Medium | Conditional | Optional for routine |
| T4 | Low | High | Never required |

### Agent Roles

- **Product Agent**: Translates founder vision into user stories and backlog
- **Code Agent**: Implements features, fixes bugs, writes code
- **Reliability Agent**: Validates quality, runs tests, monitors system health
- **Knowledge Agent**: Captures decisions, maintains documentation, learns from operations
- **Advisor Agent**: Provides external advisory counsel (never writes to repo)

## Using This Framework

### Step 1: Initialize for Your Product

Clone and customize:
```bash
git clone https://github.com/your-org/autonomous-engineering-os.git my-product
cd my-product
# Customize for your product
```

### Step 2: Define Your Product

Populate `PRODUCT/` with:
- Product vision and positioning
- Target users and problems solved
- Core features for MVP

### Step 3: Start Development

The autonomous system will:
1. Parse your product requirements
2. Create user stories in BACKLOG/
3. Implement features per best practices
4. Validate with tests
5. Deploy safely (with your approval)

### Step 4: Iterate

- Founder provides feedback and new requirements
- System captures decisions and learns
- Architecture and runbooks built up over time
- Product evolves with minimal founder engineering time

## Key Documents

### Start Here

1. **FRAMEWORK_REQUIREMENTS.md**: Understand what this system is and how it works
2. **GOVERNANCE/GUARDRAILS.md**: Review approval gates and safety rules
3. **AGENTS/ROLES.md**: Understand how agents work together

### For Reference

4. **AGENTS/CONTRACTS.md**: What each agent must produce
5. **FRAMEWORK_KNOWLEDGE/engineering_standards.md**: Code quality expectations
6. **FRAMEWORK_KNOWLEDGE/testing_strategy.md**: How we test
7. **FRAMEWORK_KNOWLEDGE/deployment_philosophy.md**: How we deploy safely

## System Requirements

To use this framework effectively:

- Git repository management
- CI/CD pipeline (GitHub Actions, CircleCI, etc.)
- Ability to provide approval at gates
- Access to deploy to environments (staging, production)

## Non-Goals

- This is not a chatbot or code generation tool
- This is not a no-code platform
- This is not a product idea — it's how to build products autonomously
- This does not replace human founder decision-making

## Contributing

This is a framework, not a product. When adapting:

1. Keep the framework structure intact
2. Extend with product-specific content
3. Share improvements back if useful for others

## License

This framework is provided as-is for building products. Adapt and use per your needs.

## Support

For questions about this framework:
- Review documentation in `FRAMEWORK_KNOWLEDGE/`
- Check `AGENTS/` for agent behavior expectations
- Reference `GOVERNANCE/` for rules and guardrails

---

**Built for solo founders who need engineering power without being engineers.**

 autonomous-engineering-os © Factory
