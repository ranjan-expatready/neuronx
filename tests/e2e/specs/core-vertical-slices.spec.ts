import { test, expect } from '@playwright/test';

test.describe('Core Vertical Slices', () => {
  test('qualification → opportunity flow', async ({ page }) => {
    // Navigate to lead management interface
    await page.goto('/leads');

    // Create a test lead
    await page.getByRole('button', { name: /add lead|new lead/i }).click();
    await page.getByLabel(/first name/i).fill('Jane');
    await page.getByLabel(/last name/i).fill('Smith');
    await page.getByLabel(/email/i).fill('jane.smith@test.com');
    await page.getByLabel(/company/i).fill('TechCorp');
    await page.getByRole('button', { name: /save|create/i }).click();

    // Wait for qualification to complete
    await expect(page.getByText(/qualified|scoring complete/i)).toBeVisible();

    // Check qualification score is displayed
    await expect(page.getByText(/\d+\/\d+/)).toBeVisible(); // Score format like "85/100"

    // If qualified, opportunity should be created
    const opportunityVisible = await page
      .getByText(/opportunity|deal/i)
      .isVisible();
    if (opportunityVisible) {
      await expect(
        page.getByText(/opportunity created|deal opened/i)
      ).toBeVisible();
    }
  });

  test('SLA → escalation flow', async ({ page }) => {
    await page.goto('/leads');

    // Find or create a lead that should trigger SLA monitoring
    await page.getByRole('button', { name: /add lead|new lead/i }).click();
    await page.getByLabel(/first name/i).fill('Urgent');
    await page.getByLabel(/last name/i).fill('Customer');
    await page.getByLabel(/email/i).fill('urgent@test.com');
    await page.getByLabel(/priority/i).selectOption('high');
    await page.getByRole('button', { name: /save|create/i }).click();

    // Wait for SLA monitoring to start
    await expect(
      page.getByText(/sla.*monitoring|sla.*tracking/i)
    ).toBeVisible();

    // Simulate time passing (in real test, this might be mocked)
    // For now, check that SLA indicators are present
    await expect(page.getByText(/\d+.*minutes?|sla.*breach/i)).toBeVisible();

    // Check escalation logic (if SLA is about to breach)
    const escalationVisible = await page
      .getByText(/escalation|priority.*increased/i)
      .isVisible();
    if (escalationVisible) {
      await expect(
        page.getByText(/escalated to|assigned to manager/i)
      ).toBeVisible();
    }
  });

  test('conversation → rescoring flow', async ({ page }) => {
    await page.goto('/conversations');

    // Start or open a conversation
    await page
      .getByRole('button', { name: /new conversation|start chat/i })
      .click();

    // Simulate conversation messages that should trigger rescoring
    const messages = [
      "Hi, I'm very interested in your enterprise solution",
      'We have 500 employees and need something scalable',
      'Budget is not a constraint for the right solution',
    ];

    for (const message of messages) {
      await page.getByRole('textbox', { name: /message|chat/i }).fill(message);
      await page.getByRole('button', { name: /send/i }).click();

      // Wait for message to be processed
      await expect(page.getByText(message)).toBeVisible();
    }

    // Check that conversation analysis triggered rescoring
    await expect(
      page.getByText(/analyzing|processing|sentiment/i)
    ).toBeVisible();

    // Verify lead score was updated
    await page.goto('/leads');
    await expect(
      page.getByText(/score updated|rescored|sentiment.*positive/i)
    ).toBeVisible();

    // Check sentiment indicators
    await expect(
      page.getByText(/positive|enthusiastic|high.*intent/i)
    ).toBeVisible();
  });

  test('AI-assisted decision flow', async ({ page }) => {
    await page.goto('/leads');

    // Create a lead that would benefit from AI assistance
    await page.getByRole('button', { name: /add lead|new lead/i }).click();
    await page.getByLabel(/first name/i).fill('AI');
    await page.getByLabel(/last name/i).fill('Test');
    await page.getByLabel(/email/i).fill('ai.test@example.com');
    await page.getByLabel(/company/i).fill('BigTech Corp');
    await page.getByLabel(/industry/i).selectOption('technology');
    await page.getByLabel(/company size/i).fill('1000');
    await page.getByRole('button', { name: /save|create/i }).click();

    // Wait for AI processing
    await expect(
      page.getByText(/ai.*processing|analyzing|scoring/i)
    ).toBeVisible();

    // Check enhanced scoring is applied
    await expect(
      page.getByText(/enhanced.*score|ai.*recommendation/i)
    ).toBeVisible();

    // Verify Cipher monitoring (should not block in monitor mode)
    await expect(
      page.getByText(/cipher.*checked|decision.*logged/i)
    ).toBeVisible();

    // Check predictive routing suggestions
    await expect(
      page.getByText(/suggested.*team|routing.*recommendation/i)
    ).toBeVisible();
  });
});
