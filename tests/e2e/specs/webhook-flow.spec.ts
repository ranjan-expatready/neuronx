import { test, expect } from '@playwright/test';

test.describe('Webhook Receipt + Signature Verification', () => {
  test('should accept and process valid webhook', async ({ page }) => {
    // Navigate to webhook test page or admin panel
    await page.goto('/admin/webhooks/test');

    // Trigger a test webhook (this would typically be done via API call)
    const webhookPayload = {
      id: 'test-webhook-001',
      tenantId: 'test-tenant',
      type: 'contact.created',
      payload: {
        contact: {
          id: 'contact-123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
        },
      },
    };

    // Simulate webhook receipt (in real implementation, this would be server-side)
    await page.evaluate(payload => {
      // Simulate webhook processing
      console.log('Processing webhook:', payload);
      return fetch('/api/webhooks/ghl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GHL-Signature': 'mock_signature',
        },
        body: JSON.stringify(payload),
      });
    }, webhookPayload);

    // Check that webhook was processed successfully
    await page.reload();
    await expect(
      page.getByText(/webhook processed|contact created/i)
    ).toBeVisible();
  });

  test('should reject webhook with invalid signature', async ({ page }) => {
    await page.goto('/admin/webhooks/test');

    const webhookPayload = {
      id: 'test-webhook-invalid',
      tenantId: 'test-tenant',
      type: 'contact.created',
      payload: { contact: { id: 'contact-456' } },
    };

    // Attempt to send webhook with invalid signature
    const response = await page.evaluate(payload => {
      return fetch('/api/webhooks/ghl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GHL-Signature': 'invalid_signature',
        },
        body: JSON.stringify(payload),
      }).then(r => r.status);
    }, webhookPayload);

    // Should return 401 Unauthorized
    expect(response).toBe(401);

    // Should log security event
    await expect(
      page.getByText(/invalid signature|security event/i)
    ).toBeVisible();
  });

  test('should handle webhook replay attacks', async ({ page }) => {
    await page.goto('/admin/webhooks/test');

    const webhookPayload = {
      id: 'test-webhook-replay',
      tenantId: 'test-tenant',
      type: 'contact.created',
      payload: { contact: { id: 'contact-789' } },
    };

    // Send webhook twice with same ID
    for (let i = 0; i < 2; i++) {
      await page.evaluate(payload => {
        return fetch('/api/webhooks/ghl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GHL-Signature': 'mock_signature',
            'X-Webhook-ID': payload.id,
          },
          body: JSON.stringify(payload),
        });
      }, webhookPayload);
    }

    // Second webhook should be rejected
    await page.reload();
    await expect(
      page.getByText(/replay detected|duplicate webhook/i)
    ).toBeVisible();
  });
});
