# Acceptance Criteria Template

Purpose: Standardized template for writing clear, testable acceptance criteria using Given/When/Then format. Ensures features are well-defined before development begins.

## Template Format

```gherkin
Feature: [Feature Name]

  Scenario: [Scenario Description]
    Given [initial context or state]
    When [action or event occurs]
    Then [expected outcome or behavior]

  Scenario: [Alternative/Error Scenario]
    Given [different context]
    When [different action]
    Then [different expected outcome]
```

## Feature Categories

### Intelligence Features

**AI-driven lead scoring**

```gherkin
Feature: AI-driven lead scoring

  Scenario: High-quality lead scoring
    Given a lead with complete contact information and engagement history
    When the scoring algorithm processes the lead data
    Then a score between 0-100 is generated with >95% accuracy against historical conversions

  Scenario: Incomplete lead handling
    Given a lead with minimal information available
    When the scoring algorithm processes incomplete data
    Then a conservative score is assigned with uncertainty indicators
```

**Predictive pipeline analytics**

```gherkin
Feature: Predictive pipeline analytics

  Scenario: Pipeline forecasting
    Given 6+ months of historical pipeline data
    When predictive analytics run on current pipeline
    Then quarterly forecasts are generated within 15% accuracy of actual results

  Scenario: Insufficient data handling
    Given less than 3 months of historical data
    When forecasting is requested
    Then conservative estimates are provided with confidence intervals
```

### Configuration Features

**Rule-based process configuration**

```gherkin
Feature: Rule-based process configuration

  Scenario: Valid rule configuration
    Given a revenue operations manager with admin access
    When creating a lead routing rule with valid conditions
    Then the rule is saved, versioned, and applied to new leads

  Scenario: Invalid rule validation
    Given a rule configuration with conflicting conditions
    When validation runs
    Then clear error messages are displayed and rule is not saved
```

### Orchestration Features

**Automated task assignment**

```gherkin
Feature: Automated task assignment

  Scenario: Optimal task distribution
    Given available sales capacity and task priority matrix
    When new high-priority tasks are created
    Then tasks are assigned to highest-capacity, best-matched representatives

  Scenario: Capacity constraints
    Given all representatives at maximum capacity
    When new tasks are created
    Then tasks are queued with capacity alerts to managers
```

### Integration Features

**GoHighLevel adapter integration**

```gherkin
Feature: GoHighLevel adapter integration

  Scenario: Workflow execution command
    Given a NeuronX orchestration command for lead nurturing
    When sent through GHL adapter
    Then correct GHL API calls are made with proper authentication

  Scenario: API failure handling
    Given GHL API returns rate limit error
    When adapter processes the command
    Then command is queued for retry with exponential backoff
```

## Writing Guidelines

### Given (Context Setup)

- Describe the initial state or preconditions
- Include user roles, data states, system configurations
- Be specific about what's already in place

### When (Action/Event)

- Describe the trigger or user action
- Focus on what happens, not how
- Keep it to one primary action per scenario

### Then (Expected Outcome)

- Describe observable results or behaviors
- Include performance requirements where relevant
- Specify error conditions and edge cases

### Best Practices

- **Testable**: Each criterion must be verifiable through automated tests
- **Independent**: Scenarios should not depend on each other
- **Clear**: Avoid ambiguous terms like "fast" or "user-friendly"
- **Complete**: Cover happy path, error cases, and edge conditions
- **Concise**: Keep scenarios focused and readable

## Anti-Patterns to Avoid

### Too Vague

```gherkin
# BAD
When the system processes the data
Then the user gets the right results
```

### Too Technical

```gherkin
# BAD
Given the API endpoint /v1/scoring receives a POST request
When the algorithm runs through the neural network layers
Then the response contains a JSON field "score" with value between 0 and 1
```

### Multiple Actions

```gherkin
# BAD
When the user logs in and creates a lead and assigns it
Then the lead is created and assigned correctly
```

## Integration with Development Process

1. **Before Development**: Product owner writes acceptance criteria
2. **During Development**: Engineers use criteria to write tests first (TDD)
3. **Quality Assurance**: QA validates implementation against criteria
4. **Traceability**: Link criteria to test cases in `TRACEABILITY.md`
5. **Documentation**: Include in feature specifications

## Template Shortcuts

For common patterns:

**Data Processing**

```
Given [input data type] with [specific conditions]
When [processing action] occurs
Then [expected output] is generated with [quality metrics]
```

**User Interactions**

```
Given [user role] accessing [feature area]
When [user action] is performed
Then [system response] occurs with [user-visible result]
```

**Integration Points**

```
Given [external system] provides [data/event]
When [NeuronX component] processes it
Then [expected synchronization/action] happens within [timeframe]
```

## Review Checklist

- [ ] All scenarios are testable
- [ ] Given/When/Then format used consistently
- [ ] Edge cases and error conditions covered
- [ ] Performance requirements specified where needed
- [ ] No ambiguous or subjective terms
- [ ] Independent of implementation details
- [ ] Linked to requirements in TRACEABILITY.md
