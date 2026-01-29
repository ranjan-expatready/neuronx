/**
 * Twilio Webhook Verifier - WI-033: Voice Execution Adapter Hardening
 *
 * Validates Twilio webhook signatures for security (REQ-015).
 */

import { createHmac } from 'crypto';

/**
 * Twilio webhook signature verifier
 */
export class TwilioWebhookVerifier {
  private authToken: string;

  constructor(authToken: string) {
    if (!authToken) {
      throw new Error('Twilio auth token is required for webhook verification');
    }
    this.authToken = authToken;
  }

  /**
   * Verify Twilio webhook signature
   */
  verifySignature(
    url: string,
    params: Record<string, any>,
    signature: string
  ): boolean {
    try {
      // Sort parameters alphabetically
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}${params[key]}`)
        .join('');

      // Create the expected signature
      const expectedSignature = createHmac('sha1', this.authToken)
        .update(url + sortedParams)
        .digest('base64');

      // Use constant-time comparison to prevent timing attacks
      return this.constantTimeEquals(expectedSignature, signature);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify signature from Express request
   */
  verifyExpressRequest(req: {
    protocol: string;
    get: (header: string) => string | undefined;
    originalUrl: string;
    body: Record<string, any>;
  }): boolean {
    const signature = req.get('x-twilio-signature');
    if (!signature) {
      console.warn('Missing X-Twilio-Signature header');
      return false;
    }

    // Reconstruct the URL Twilio signed
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    return this.verifySignature(url, req.body, signature);
  }

  /**
   * Verify signature from raw request data
   */
  verifyRawRequest(
    method: string,
    url: string,
    body: string,
    signature: string
  ): boolean {
    try {
      // For raw requests, we need the body as-is
      const expectedSignature = createHmac('sha1', this.authToken)
        .update(url + body)
        .digest('base64');

      return this.constantTimeEquals(expectedSignature, signature);
    } catch (error) {
      console.error('Raw webhook signature verification failed:', error);
      return false;
    }
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
   * Validate request is idempotent (REQ-015)
   * Returns deduplication key and whether request should be processed
   */
  validateIdempotency(
    callSid: string,
    eventType: string,
    processedEvents: Set<string>
  ): { key: string; shouldProcess: boolean } {
    const key = `${callSid}:${eventType}`;

    // Check if we've already processed this event
    const shouldProcess = !processedEvents.has(key);

    return { key, shouldProcess };
  }

  /**
   * Middleware function for Express.js
   */
  createMiddleware() {
    return (req: any, res: any, next: any) => {
      try {
        const isValid = this.verifyExpressRequest(req);

        if (!isValid) {
          console.warn('Invalid Twilio webhook signature', {
            ip: req.ip,
            url: req.originalUrl,
            userAgent: req.get('user-agent'),
          });

          return res.status(403).json({
            error: 'Invalid signature',
            code: 'INVALID_SIGNATURE',
          });
        }

        next();
      } catch (error) {
        console.error('Webhook verification middleware error:', error);
        return res.status(500).json({
          error: 'Verification failed',
          code: 'VERIFICATION_ERROR',
        });
      }
    };
  }
}
