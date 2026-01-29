/**
 * Webhook Management DTOs - WI-020: Webhook Endpoint Management APIs
 *
 * Request/response DTOs for tenant-scoped webhook endpoint management.
 * Ensures validation, tenant isolation, and security (no plaintext secrets).
 */

import {
  IsString,
  IsUrl,
  IsBoolean,
  IsArray,
  IsOptional,
  IsEnum,
  Matches,
  ArrayNotEmpty,
  MaxLength,
  MinLength,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// Supported event types for webhooks
export const SUPPORTED_WEBHOOK_EVENTS = [
  'payment.paid',
  'sla.timer.due',
  'sla.escalation.triggered',
  'voice.attempt.started',
  'voice.attempt.completed',
  'voice.attempt.failed',
  'voice.webhook.received',
  'webhook.test', // For test deliveries
] as const;

export type SupportedWebhookEvent = (typeof SUPPORTED_WEBHOOK_EVENTS)[number];

// ============================================================================
// REQUEST DTOs
// ============================================================================

export class CreateWebhookEndpointRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsUrl()
  @Matches(/^https:\/\//, { message: 'Webhook endpoints must use HTTPS' })
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(SUPPORTED_WEBHOOK_EVENTS, { each: true })
  eventTypes: SupportedWebhookEvent[];

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  backoffBaseSeconds?: number;
}

export class UpdateWebhookEndpointRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl()
  @Matches(/^https:\/\//, { message: 'Webhook endpoints must use HTTPS' })
  url?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(SUPPORTED_WEBHOOK_EVENTS, { each: true })
  eventTypes?: SupportedWebhookEvent[];

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  backoffBaseSeconds?: number;
}

export class RotateWebhookSecretRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason?: string;
}

export class TestWebhookDeliveryRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message?: string;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export class WebhookEndpointResponse {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  enabled: boolean;
  eventTypes: SupportedWebhookEvent[];
  timeoutMs: number;
  maxAttempts: number;
  backoffBaseSeconds: number;
  secretProvider: string;
  secretUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: string;
}

export class WebhookEndpointSummary {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  eventTypes: SupportedWebhookEvent[];
  secretProvider: string;
  secretUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastDeliveryAt?: Date;
  lastDeliveryStatus?: string;
}

export class RotateWebhookSecretResponse {
  endpointId: string;
  previousSecretRef: string;
  newSecretRef: string;
  rotatedAt: Date;
  actor: string;
  correlationId?: string;
}

export class TestWebhookDeliveryResponse {
  deliveryId: string;
  endpointId: string;
  testEventId: string;
  status: 'QUEUED' | 'DELIVERED' | 'FAILED';
  queuedAt: Date;
}

// ============================================================================
// LIST RESPONSE DTOs
// ============================================================================

export class WebhookEndpointsListResponse {
  endpoints: WebhookEndpointSummary[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export class WebhookApiError {
  error: string;
  message: string;
  tenantId?: string;
  endpointId?: string;
  correlationId?: string;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export class WebhookValidation {
  /**
   * Validate that event types are supported
   */
  static validateEventTypes(eventTypes: string[]): SupportedWebhookEvent[] {
    const invalidTypes = eventTypes.filter(
      type => !SUPPORTED_WEBHOOK_EVENTS.includes(type as SupportedWebhookEvent)
    );

    if (invalidTypes.length > 0) {
      throw new Error(`Unsupported event types: ${invalidTypes.join(', ')}`);
    }

    return eventTypes as SupportedWebhookEvent[];
  }

  /**
   * Validate HTTPS URL
   */
  static validateHttpsUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('Webhook endpoints must use HTTPS');
      }
    } catch (error) {
      throw new Error(`Invalid URL format: ${error}`);
    }
  }

  /**
   * Generate correlation ID for API operations
   */
  static generateCorrelationId(operation: string, tenantId: string): string {
    return `webhook-api-${operation}-${tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
