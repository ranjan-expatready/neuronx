/**
 * Webhook Signer - WI-018: Outbound Webhook Delivery System + WI-019: Secrets & Encryption Foundation
 *
 * HMAC SHA256 signature generation for webhook security using secure secret retrieval.
 * Follows industry-standard webhook signing patterns.
 */

import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { SecretService } from '../secrets/secret.service';
import { WebhookPayload } from './webhook.types';

@Injectable()
export class WebhookSigner {
  constructor(private readonly secretService: SecretService) {}

  /**
   * Generate HMAC SHA256 signature for webhook payload
   * Signature format: sha256={hmac}
   * Signed content: {timestamp}.{jsonBody}
   */
  async signPayload(
    payload: WebhookPayload,
    secretRef: string,
    timestamp: string
  ): Promise<string> {
    const secret = await this.secretService.getSecret(secretRef);

    const jsonBody = JSON.stringify(payload, Object.keys(payload).sort());
    const content = `${timestamp}.${jsonBody}`;

    const hmac = createHmac('sha256', secret);
    hmac.update(content);
    const signature = hmac.digest('hex');

    return `sha256=${signature}`;
  }

  /**
   * Verify webhook signature (for testing/mirroring)
   * Returns true if signature is valid
   */
  async verifySignature(
    payload: WebhookPayload,
    secretRef: string,
    timestamp: string,
    signature: string
  ): Promise<boolean> {
    const expectedSignature = await this.signPayload(
      payload,
      secretRef,
      timestamp
    );

    // Use constant-time comparison to prevent timing attacks
    return this.constantTimeEquals(expectedSignature, signature);
  }

  /**
   * Generate timestamp for webhook signing
   */
  generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Create signed headers for webhook delivery
   */
  async createSignedHeaders(
    payload: WebhookPayload,
    secretRef: string,
    deliveryId: string
  ): Promise<{ headers: Record<string, string>; timestamp: string }> {
    const timestamp = this.generateTimestamp();
    const signature = await this.signPayload(payload, secretRef, timestamp);

    const headers = {
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Event': payload.eventType,
      'X-Webhook-Delivery-Id': deliveryId,
      'X-Tenant-Id': payload.tenantId,
      'Content-Type': 'application/json',
      'User-Agent': 'NeuronX-Webhook-Delivery/1.0',
    };

    if (payload.correlationId) {
      headers['X-Correlation-Id'] = payload.correlationId;
    }

    return { headers, timestamp };
  }
}
