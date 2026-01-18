/**
 * Voice Twilio Adapter - WI-033: Voice Execution Adapter Hardening
 *
 * Exports for the voice-twilio adapter package.
 */

// Types
export * from './types';

// Core components
export { TwilioClient } from './twilio.client';
export { TwilioWebhookVerifier } from './twilio.webhook-verifier';
export { TwilioVoiceExecutionAdapter } from './voice-execution-adapter';

// Re-export interface
export type { VoiceExecutionAdapter } from './types';
