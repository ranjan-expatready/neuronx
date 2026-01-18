describe('NeuronX Core User Flow', () => {
  beforeEach(() => {
    // Seed test data before each test
    cy.seedTestData();

    // Login if authentication is required
    // cy.login('admin@test.com', 'password');
  });

  afterEach(() => {
    // Clean up test data after each test
    cy.cleanTestData();
  });

  it('should complete lead qualification flow', () => {
    // Visit the leads page
    cy.visit('/leads');

    // Verify page loaded
    cy.contains('Leads').should('be.visible');

    // Create a new lead
    cy.get('[data-testid="add-lead"], .add-lead, button')
      .contains(/add|new/i)
      .click();

    // Fill out lead form
    cy.get(
      '[data-testid="first-name"], input[name*="first"], input[placeholder*="first"]'
    ).type('Cypress');
    cy.get(
      '[data-testid="last-name"], input[name*="last"], input[placeholder*="last"]'
    ).type('Test');
    cy.get(
      '[data-testid="email"], input[type="email"], input[name*="email"]'
    ).type('cypress.test@example.com');
    cy.get('[data-testid="company"], input[name*="company"]').type(
      'CypressCorp'
    );
    cy.get('[data-testid="industry"], select[name*="industry"]').select(
      'technology'
    );

    // Submit the form
    cy.get('[data-testid="submit"], button[type="submit"], .submit')
      .contains(/save|create/i)
      .click();

    // Wait for processing and verify qualification
    cy.waitForAIProcessing();

    // Verify lead was created and scored
    cy.contains('cypress.test@example.com').should('be.visible');
    cy.contains(/\d+\/\d+/).should('be.visible'); // Score display

    // Verify AI-enhanced scoring
    cy.contains(/enhanced|ai.*score/i).should('be.visible');

    // Verify Cipher monitoring
    cy.verifyCipherMonitoring();
  });

  it('should demonstrate conversation analysis', () => {
    // Start with a lead that has conversations
    cy.visit('/leads');

    // Find and open the test lead
    cy.contains('cypress.test@example.com').click();

    // Navigate to conversations tab
    cy.get('[data-testid="conversations-tab"], .conversations, a')
      .contains(/conversation|chat/i)
      .click();

    // Start a conversation or simulate messages
    cy.get('[data-testid="new-message"], .new-message, textarea').type(
      "Hi, I'm very interested in your solution for our 500-person team."
    );

    cy.get('[data-testid="send-message"], .send, button')
      .contains(/send/i)
      .click();

    // Wait for AI analysis
    cy.waitForAIProcessing();

    // Verify sentiment analysis
    cy.contains(/positive|sentiment|analysis/i).should('be.visible');

    // Verify lead score was updated
    cy.get('[data-testid="lead-score"], .score').should('contain', /\d+\/\d+/);

    // Check conversation insights
    cy.contains(/enthusiastic|high.*intent|qualified/i).should('be.visible');
  });

  it('should show predictive routing recommendations', () => {
    cy.visit('/leads');

    // Find a qualified lead
    cy.contains('Qualified').first().click();

    // Check for routing recommendations
    cy.contains(/routing|suggested|recommended/i).should('be.visible');

    // Verify team suggestions are displayed
    cy.get(
      '[data-testid="team-suggestions"], .team-suggestions, .routing-options'
    )
      .should('be.visible')
      .and('contain', /team|representative|assign/i);

    // Verify confidence scores
    cy.contains(/\d+%|\d+\.\d+/).should('be.visible'); // Confidence percentage

    // Verify Cipher logged the routing decision
    cy.verifyCipherMonitoring();
  });

  it('should handle error scenarios gracefully', () => {
    cy.visit('/leads');

    // Try to create a lead with invalid data
    cy.get('[data-testid="add-lead"]').click();

    // Submit without required fields
    cy.get('[data-testid="submit"]').click();

    // Should show validation errors
    cy.contains(/required|invalid|error/i).should('be.visible');

    // Fill out form correctly and retry
    cy.get('[data-testid="first-name"]').type('Error');
    cy.get('[data-testid="last-name"]').type('Test');
    cy.get('[data-testid="email"]').type('error.test@example.com');
    cy.get('[data-testid="submit"]').click();

    // Should succeed this time
    cy.contains('error.test@example.com').should('be.visible');
  });

  it('should demonstrate admin monitoring capabilities', () => {
    // Visit admin dashboard
    cy.visit('/admin');

    // Check system health
    cy.contains(/health|status|system/i).should('be.visible');

    // Verify recent activity logs
    cy.get('[data-testid="activity-logs"], .logs, .activity')
      .should('be.visible')
      .and('contain', /created|processed|scored/i);

    // Check Cipher monitoring dashboard
    cy.contains(/cipher|monitoring|decisions/i).should('be.visible');

    // Verify performance metrics
    cy.contains(/performance|latency|response/i).should('be.visible');
  });
});
