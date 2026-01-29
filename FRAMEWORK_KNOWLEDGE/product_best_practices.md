# Product Best Practices — Building Products the Right Way

## Overview

This document encapsulates product development best practices that should be applied across all work. It's not specific to any one product — it's universal guidance for building successful software products.

---

## MVP PHILOSOPHY

### Start Small, Validate Early

**Principle**: Build the smallest thing that validates the core hypothesis, not the "complete" product.

**Application**:
- Define the 1-2 core features that prove the value proposition
- Defer everything else to later
- Ship early and measure usage
- Talk to users before building more

**Example**:

**Don't Build**:
- Full user management system
- Complex dashboard with analytics
- Social sharing features
- Mobile apps for iOS and Android

**Build First**:
- Core user registration and login (minimal)
- The main value-delivering feature
- Simple way to see results
- Basic data capture for measurement

---

### Focus on the Core Job-to-be-Done

**Principle**: Understand what problem the product solves and focus energy there.

**Application**:
- Explicitly identify the primary job-to-be-done
- Every feature should support the JTBD
- Question: Does this help with the core problem?
- If no, defer or reject

**Example**:

**Product**: AI writing assistant
**JTBD**: Help writers produce better content faster

**Good features** (support JTBD):
- AI text generation
- Grammar checking
- Tone adjustment

**Defer** (don't directly support JTBD):
- User profiles with photos (nice to have)
- Social sharing (distracts from core)
- Complex billing with discounts (can start simple)

---

## REQUIREMENTS ELICITATION

### Understand Before Designing

**Principle**: Spend time understanding the problem before jumping to solutions.

**Questions to Ask**:

1. **Who**:
   - Who is this for?
   - What do they do now?
   - What skills do they have?

2. **What**:
   - What problem are they trying to solve?
   - What happens if they don't solve it?
   - What does success look like?

3. **Why**:
   - Why do they need this now?
   - Why do other solutions fail?
   - Why are you building this?

4. **When**:
   - When do they use this?
   - How often?
   - In what context?

5. **How**:
   - How would they ideally solve this?
   - What constraints do they have?
   - What are non-negotiable requirements?

**Output**:
- Well-defined problem statement
- Clear success criteria
- Understanding of constraints
- Identification of stakeholders

---

### Write User Stories, Not Requirements

**Principle**: User stories focus on value, requirements focus on features.

**User Story Format**:
```
As a [user type],
I want to [action],
so that [benefit].
```

**Bad Requirement**:
```
The system shall have a login form with email and password fields.
```

**Good User Story**:
```
As a user,
I want to sign in with my email and password,
so that I can access my account and resume where I left off.
```

**Difference**:
- Requirements specify how
- User stories explain why
- Requirements constrain solutions
- User stories enable creativity

---

### Acceptance Criteria Must Be Testable

**Principle**: If you can't test it, it's not a good acceptance criterion.

**Bad**:
```
- The system should be fast
- The user experience should be good
- The error handling should be robust
```

**Good**:
```
- Login completes in < 2 seconds on 3G network
- Users can complete sign-up in < 30 seconds
- All errors display a friendly message with next steps
- System handles 100 concurrent users with < 5% latency increase
```

---

## PRODUCT PLANNING

### Prioritize by Impact and Effort

**Principle**: High impact, low effort work should be prioritized.

**Impact vs. Effort Matrix**:

| Impact / Effort | Low Effort | High Effort |
|-----------------|------------|-------------|
| **High Impact** | **DO FIRST** (Quick wins) | **DO SECOND** (Major bets) |
| **Low Impact** | Defer | **DON'T DO** |

**Application**:
1. List all potential features
2. Estimate impact (to users/business) as 1-10
3. Estimate effort as Small/Medium/Large
4. Prioritize high impact / low effort first

---

### Avoid Feature Creep

**Principle**: Every feature has a cost. Be selective.

**Cost of Each Feature**:
- Development time and cost
- Testing and maintenance burden
- User cognitive load (more to learn)
- Product complexity (harder to use, more that can break)

**Questions Before Adding Feature**:
1. Does this support the core JTBD?
2. Is this essential for MVP or can it wait?
3. How does this compete with existing features for user attention?
4. Can we achieve same goal simpler?

**Feature Creep Signs**:
- "It should also have..."
- "What if users want to..."
- "It would be cool if..."

**Response**:
- "For MVP, let's focus on..."
- "Let's validate the core first"
- "We can add that after we see usage"

---

### Consider the Full User Journey

**Principle**: Products are experienced over time, not in isolated features.

**Journey Mapping**:

1. **Before** (Discovery)
   - How do users find the product?
   - What problem state are they in?

2. **Onboarding** (First Use)
   - How do they get started?
   - What's their first impression?
   - How quickly can they see value? (Time-to-Value)

3. **Core Use** (Regular Use)
   - What's the primary use case?
   - How often do they use it?
   - What's the moment of peak value?

4. **Expansion** (Deepening)
   - How do they discover more features?
   - When do they become power users?

5. **Retention** (Long-term)
   - What keeps them coming back?
   - What causes churn?
   - How do they become advocates?

**Apply**: Design for each stage, prioritize improving early stages first.

---

## PRODUCT VALIDATION

### Measure the Right Things

**Principle**: What you measure drives what you build.

**Metrics Hierarchy**:

**North Star** (the one that matters most):
- Examples: "Active users using core feature weekly", "Value delivered per user"

**Leading Indicators** (predict future):
- New sign-ups, activation rate, first-time use of core feature

**Lagging Indicators** (report past):
- Revenue, retention, NPS

**Vanity Metrics** (avoid these):
- Total downloads (don't mean active usage)
- Social media followers (don't drive product value)
- Time on site (without context, meaningless)

**Example for Saas MVP**:
```
North Star: Users who complete core workflow weekly
Leading: New signups, activation (% who use core feature after signup)
Lagging: Revenue, MRR, churn rate
```

---

### Talk to Users

**Principle**: No amount of data replaces talking to actual users.

**When to Talk to Users**:
- Before building anything (discovery)
- While building (early feedback)
- After launch (understand usage and issues)

**How to Ask Good Questions**:

**Don't Ask** (leading, hypothetical):
- "Would you pay $20 for this?"
- "Do you like this feature?"
- "What features do you want?"

**Do Ask** (past behavior, specific):
- "Tell me about the last time you tried to [do this]."
- "What did you do when [problem happened]?"
- "Walk me through how you currently solve [problem]."

**Listen For**:
- Workarounds they've developed
- Frustrations they express (even if not asked)
- Words they use (use in your product)
- Assumptions they make that might be wrong

---

### Ship and Measure, Don't Guess

**Principle**: Real usage data beats hypothetical discussions.

**MVP Ship Process**:
1. Build smallest viable thing
2. Ship to small group
3. Measure key metrics
4. Talk to users
5. Learn what works/doesn't
6. Decide: pivot, persevere, or kill

**Avoid**:
- Spending months building before shipping
- Perfecting features no one uses
- Debating decisions that data can resolve

---

## USER EXPERIENCE PRINCIPLES

### Make It Simple

**Principle**: The simplest solution that works is often best.

**Simplicity Techniques**:
- Remove, don't add: Ask what can you eliminate first
- Reduce steps: Can this be done in fewer clicks?
- Reduce choices: Paralysis by analysis applies to UX too
- Clear defaults: Most users won't change settings

**Example**:

**Complex**:
```
1. User selects their country from 200+ options
2. User enters their address
3. User selects shipping method from 5 options
4. User enters payment info
5. User selects "Save default payment"
6. User enters promo code (optional)
7. User confirms order
```

**Simple**:
```
1. User enters email and address (detected from account)
2. User confirms default shipping and payment
3. User places order
(Avatar settings address, methods, and promo codes later)
```

---

### Design for Failure States

**Principle**: Things will go wrong. Make failure graceful.

**Failure State Checklist**:

**Onboarding Failure**:
- What if email verification fails?
- What if they can't complete signup?
- What if they enter invalid info?

**Core Usage Failure**:
- What if the feature doesn't work?
- What if there's a network error?
- What if the action takes too long?

**Payment Failure**:
- What if payment is declined?
- What if transaction times out?
- What if user disputes charge?

**Best Practice**:
- Always show friendly, helpful error messages
- Provide clear next steps (what should they do?)
- Log errors for debugging
- Consider retry mechanisms for transient failures

---

### Accessibility is Not Optional

**Principle**: Building inaccessible products excludes users and exposes you to legal risk.

**Accessibility Basics**:

1. **Visual**:
   - Color contrast ratios (WCAG AA)
   - Text resizing support
   - Screen reader compatibility
   - Keyboard navigation

2. **Motor**:
   - All actions accessible via keyboard
   - Large touch targets for mobile
   - No time-limited interaction (unless user can extend)

3. **Cognitive**:
   - Clear, simple language
   - Consistent navigation
   - Error messages are helpful
   - No distractions from core task

**Implementation**:
- Use semantic HTML elements
- Test with screen readers
- Test keyboard-only navigation
- Validate color contrast

---

## PRODUCT STRATEGY

### Define Positioning

**Principle**: Clear positioning makes all product decisions easier.

**Positioning Statement**:
```
For [target user],
who has [problem they're trying to solve],
our product is [product category],
that provides [unique value proposition].
Unlike [alternatives],
we [differentiator].
```

**Example**:
```
For solo founders building SaaS products,
who need engineering support but are non-technical,
Autonomous Engineering OS is a self-governing AI engineering system,
that provides autonomous software development with human oversight.
Unlike hiring freelancers or agencies,
we operate within guardrails and track all decisions for transparency.
```

**Why Positioning Matters**:
- Informs feature decisions (does this support our positioning?)
- Guides marketing and messaging
- Helps founder say "no" to distractions

---

### Consider the Business Model

**Principle**: How you make money should inform product decisions.

**Common Models**:

**SaaS Subscription**:
- Product: Focus on retention and recurring value
- Pricing: Clear tiers that make sense for usage
- Metric: MRR, churn, LTV

**Marketplace**:
- Product: Balance both sides (buyers and sellers)
- Pricing: Transaction % or listing fees
- Metric: GMV, take rate, match rate

**Freemium**:
- Product: Free value creates upgrade urgency
- Pricing: Clear differentiation between free/paid
- Metric: Free-to-paid conversion rate

**Application**:
Start simple! Even MVP should consider:
- How will this eventually make money?
- What's the minimum to start charging?
- What's the value metric for pricing?

---

### Plan for Scale, Build for Now

**Principle**: Don't over-engineer for scale you don't have, but don't paint yourself into a corner.

**Build for Now**:
- Simple architecture for MVP
- Single database instance
- Manual processes where appropriate
- Direct customer support

**Plan for Scale**:
- Use services that scale (PostgreSQL scales well)
- Design for statelessness where possible
- Use standard patterns (easy to scale later)
- Consider eventual needs (internationalization, etc.)

**Over-Engineering Signs**:
- Kubernetes for Day 1
- Microservices for simple MVP
- Building your own queue instead of using SQS
- Complex caching for small user base

**Short-Termism Signs**:
- Hardcoded values that will be difficult to change
- No environment configuration management
- No logging/monitoring (can't debug issues)
- No way to do data migrations

---

## SUMMARY OF PRODUCT BEST PRACTICES

| Area | Key Principles |
|------|----------------|
| **MVP** | Start small, focus on core JTBD, validate early |
| **Requirements** | Understand first, write user stories, testable criteria |
| **Planning** | Impact vs. effort, avoid feature creep, consider user journey |
| **Validation** | Measure right things, talk to users, ship and measure |
| **UX** | Simplicity, failure states, accessibility |
| **Strategy** | Define positioning, consider business model, plan for scale |

---

## VERSION HISTORY

- v1.0 (Initial): Core product development best practices for building software products
