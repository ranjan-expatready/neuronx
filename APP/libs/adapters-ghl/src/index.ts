// GoHighLevel Adapter Package - Minimal interfaces for read-only operations
// This package provides only the types and interfaces needed for WI-070 GHL read adapter

// Re-export domain models and types
import type {
  Lead,
  Opportunity,
  Pipeline,
  User,
  AdapterContext,
} from '@neuronx/domain';

export type {
  Lead,
  Opportunity,
  Pipeline,
  User,
  AdapterContext,
  BaseEntity,
  PipelineStage,
  AdapterError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  AuthenticationError,
  AuthorizationError,
} from '@neuronx/domain';

// Re-export observability types
export type { Logger, LogContext } from '@neuronx/observability';

// Minimal GhlAdapter interface for read-only operations
export interface GhlAdapter {
  // Read-only methods only - no mutations
  getContact(id: string, context: AdapterContext): Promise<Lead>;
  listContacts(
    context: AdapterContext,
    filters?: any
  ): Promise<{ contacts: Lead[]; total: number }>;
  getOpportunity(id: string, context: AdapterContext): Promise<Opportunity>;
  listOpportunities(
    context: AdapterContext,
    filters?: any
  ): Promise<{ opportunities: Opportunity[]; total: number }>;
  getPipelines(context: AdapterContext): Promise<Pipeline[]>;
  getUsers(context: AdapterContext): Promise<User[]>;
}

// No-op implementation for compilation - throws errors for any operations
export class GhlAdapterImpl implements GhlAdapter {
  getContact(_id: string, _context: AdapterContext): Promise<Lead> {
    throw new Error(
      'GhlAdapterImpl is a no-op stub for compilation only. Use real GHL adapter in production.'
    );
  }

  listContacts(
    _context: AdapterContext,
    _filters?: any
  ): Promise<{ contacts: Lead[]; total: number }> {
    throw new Error(
      'GhlAdapterImpl is a no-op stub for compilation only. Use real GHL adapter in production.'
    );
  }

  getOpportunity(_id: string, _context: AdapterContext): Promise<Opportunity> {
    throw new Error(
      'GhlAdapterImpl is a no-op stub for compilation only. Use real GHL adapter in production.'
    );
  }

  listOpportunities(
    _context: AdapterContext,
    _filters?: any
  ): Promise<{ opportunities: Opportunity[]; total: number }> {
    throw new Error(
      'GhlAdapterImpl is a no-op stub for compilation only. Use real GHL adapter in production.'
    );
  }

  getPipelines(_context: AdapterContext): Promise<Pipeline[]> {
    throw new Error(
      'GhlAdapterImpl is a no-op stub for compilation only. Use real GHL adapter in production.'
    );
  }

  getUsers(_context: AdapterContext): Promise<User[]> {
    throw new Error(
      'GhlAdapterImpl is a no-op stub for compilation only. Use real GHL adapter in production.'
    );
  }
}

// Export a factory function
export function createGhlAdapter(_config?: any): GhlAdapter {
  return new GhlAdapterImpl();
}
