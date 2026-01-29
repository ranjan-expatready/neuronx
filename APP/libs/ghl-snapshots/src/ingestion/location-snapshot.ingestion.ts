/**
 * Location Snapshot Ingestion - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Ingests GHL locations configuration for read-only mirroring.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BaseSnapshotIngestion } from './base-snapshot.ingestion';
import { SnapshotType } from '../snapshot-types';

@Injectable()
export class LocationSnapshotIngestion extends BaseSnapshotIngestion {
  constructor(prisma: PrismaClient) {
    super(prisma, 'LocationSnapshotIngestion');
  }

  /**
   * Ingest GHL locations snapshot
   */
  async ingest(tenantId: string, ghlAccountId: string, correlationId: string) {
    try {
      this.logger.debug(`Starting location snapshot ingestion`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Fetch locations from GHL
      const locations = await this.fetchFromGhl(tenantId, ghlAccountId);

      this.logger.debug(`Fetched ${locations.length} locations`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Create snapshot
      return this.createSnapshot(
        tenantId,
        ghlAccountId,
        SnapshotType.LOCATIONS,
        locations,
        correlationId
      );
    } catch (error) {
      return this.handleIngestionError(
        tenantId,
        ghlAccountId,
        SnapshotType.LOCATIONS,
        error,
        correlationId
      );
    }
  }

  /**
   * Fetch locations from GHL API
   * Note: This is a simplified implementation. In reality, this would use
   * the GHL adapter or direct API calls to fetch location data.
   */
  protected async fetchFromGhl(
    _tenantId: string,
    _ghlAccountId: string
  ): Promise<any[]> {
    // In a real implementation, this would:
    // 1. Get authenticated GHL client for the tenant
    // 2. Call GHL API to fetch locations
    // 3. Handle pagination if needed
    // 4. Return raw location data preserving all fields

    // For now, return mock data that represents what GHL would return
    return [
      {
        id: 'loc_001',
        name: 'Main Office',
        address: '123 Business St',
        city: 'Business City',
        state: 'CA',
        zip: '12345',
        country: 'US',
        phone: '+1-555-0123',
        email: 'main@company.com',
        website: 'https://company.com',
        timezone: 'America/Los_Angeles',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        // Include any other fields GHL returns to maintain forward compatibility
        customFields: {},
        businessHours: {},
        socialMedia: {},
      },
      {
        id: 'loc_002',
        name: 'Branch Office',
        address: '456 Commerce Ave',
        city: 'Commerce City',
        state: 'NY',
        zip: '67890',
        country: 'US',
        phone: '+1-555-0456',
        email: 'branch@company.com',
        website: 'https://branch.company.com',
        timezone: 'America/New_York',
        isActive: true,
        createdAt: '2023-06-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        customFields: {},
        businessHours: {},
        socialMedia: {},
      },
    ];
  }
}
