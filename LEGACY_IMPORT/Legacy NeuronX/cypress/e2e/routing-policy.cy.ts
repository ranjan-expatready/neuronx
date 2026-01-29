/// <reference types="cypress" />

describe('Routing Policy Editor', () => {
  beforeEach(() => {
    // We assume the frontend mocks the user as Admin by default in dev/test mode
    // See apps/operator-ui/lib/auth.tsx
    
    // Visit the routing page directly
    cy.visit('/routing');
  });

  it('should display the routing policy editor', () => {
    cy.contains('Routing Policy Editor').should('be.visible');
    cy.contains('Geographic Preferences').should('be.visible');
  });

  it('should allow adding a new geographic routing rule', () => {
    // Initial check - ensure we are on the page
    cy.contains('Routing Policy Editor').should('be.visible');

    // Define new rule
    const newRegion = 'test-region-' + Date.now();
    const newTeam = 'team-test';

    // Type into inputs
    cy.get('input[placeholder*="north-america"]').type(newRegion);
    cy.get('input[placeholder*="team-enterprise"]').type(newTeam);

    // Click Add
    cy.contains('button', 'Add').click();

    // Verify it appears in the list
    cy.contains(newRegion).should('be.visible');
    cy.get(`input[value="${newTeam}"]`).should('be.visible');

    // Save changes
    cy.contains('button', 'Save Changes').click();

    // Verify success message
    cy.contains('Configuration saved successfully').should('be.visible');
  });

  it('should allow removing a routing rule', () => {
    // Define rule to add then remove
    const regionToRemove = 'region-to-remove-' + Date.now();
    const teamToRemove = 'team-remove';

    // Add it first
    cy.get('input[placeholder*="north-america"]').type(regionToRemove);
    cy.get('input[placeholder*="team-enterprise"]').type(teamToRemove);
    cy.contains('button', 'Add').click();
    cy.contains(regionToRemove).should('be.visible');

    // Find the row with this region and click Remove
    // We look for the region text, then go up to the container, then find the remove button
    cy.contains(regionToRemove)
      .parent() // div.flex-1 (Region)
      .parent() // div.flex (Row)
      .find('button')
      .contains('Remove')
      .click();

    // Verify it's gone
    cy.contains(regionToRemove).should('not.exist');
    
    // Save changes
    cy.contains('button', 'Save Changes').click();
    cy.contains('Configuration saved successfully').should('be.visible');
  });
});
