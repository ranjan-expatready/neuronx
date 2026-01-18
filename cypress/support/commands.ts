// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

/// <reference types="cypress" />

// Custom command for NeuronX API authentication
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password },
    }).then(response => {
      expect(response.status).to.eq(200);
      // Store auth token if needed
      window.localStorage.setItem('authToken', response.body.token);
    });
  });
});

// Custom command for seeding test data
Cypress.Commands.add('seedTestData', () => {
  cy.request({
    method: 'POST',
    url: '/api/test/seed',
    body: {
      tenants: ['test-tenant-1'],
      leads: [
        {
          id: 'cypress-lead-001',
          firstName: 'Cypress',
          lastName: 'Test',
          email: 'cypress@test.com',
          company: 'CypressCorp',
        },
      ],
    },
  });
});

// Custom command for cleaning test data
Cypress.Commands.add('cleanTestData', () => {
  cy.request({
    method: 'POST',
    url: '/api/test/clean',
  });
});

// Custom command for waiting for AI processing
Cypress.Commands.add('waitForAIProcessing', (timeout: number = 10000) => {
  cy.get('[data-testid="ai-processing"], .ai-processing, .processing', {
    timeout,
  }).should('not.exist');
});

// Custom command for verifying Cipher monitoring
Cypress.Commands.add('verifyCipherMonitoring', () => {
  cy.get('[data-testid="cipher-log"], .cipher-log, .monitoring-log')
    .should('contain', 'Cipher decision')
    .and('contain', 'monitor');
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      seedTestData(): Chainable<void>;
      cleanTestData(): Chainable<void>;
      waitForAIProcessing(timeout?: number): Chainable<void>;
      verifyCipherMonitoring(): Chainable<void>;
    }
  }
}
