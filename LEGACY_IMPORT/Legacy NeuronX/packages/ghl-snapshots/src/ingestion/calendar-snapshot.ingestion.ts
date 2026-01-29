/**
 * Calendar Snapshot Ingestion - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Ingests GHL calendar configuration for read-only mirroring.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BaseSnapshotIngestion } from './base-snapshot.ingestion';
import { SnapshotType } from '../snapshot-types';

@Injectable()
export class CalendarSnapshotIngestion extends BaseSnapshotIngestion {
  constructor(prisma: PrismaClient) {
    super(prisma, 'CalendarSnapshotIngestion');
  }

  /**
   * Ingest GHL calendars snapshot
   */
  async ingest(tenantId: string, ghlAccountId: string, correlationId: string) {
    try {
      this.logger.debug(`Starting calendar snapshot ingestion`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Fetch calendars from GHL
      const calendars = await this.fetchFromGhl(tenantId, ghlAccountId);

      this.logger.debug(`Fetched ${calendars.length} calendars`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Create snapshot
      return this.createSnapshot(
        tenantId,
        ghlAccountId,
        SnapshotType.CALENDARS,
        calendars,
        correlationId
      );
    } catch (error) {
      return this.handleIngestionError(
        tenantId,
        ghlAccountId,
        SnapshotType.CALENDARS,
        error,
        correlationId
      );
    }
  }

  /**
   * Fetch calendars from GHL API
   */
  protected async fetchFromGhl(
    _tenantId: string,
    _ghlAccountId: string
  ): Promise<any[]> {
    // In a real implementation, this would fetch calendar configurations
    // including availability settings, booking rules, and integration settings

    return [
      {
        id: 'cal_001',
        name: 'Main Sales Calendar',
        description: 'Primary calendar for sales appointments',
        type: 'appointment',
        timezone: 'America/Los_Angeles',
        workingHours: {
          monday: { start: '09:00', end: '17:00', enabled: true },
          tuesday: { start: '09:00', end: '17:00', enabled: true },
          wednesday: { start: '09:00', end: '17:00', enabled: true },
          thursday: { start: '09:00', end: '17:00', enabled: true },
          friday: { start: '09:00', end: '17:00', enabled: true },
          saturday: { start: '10:00', end: '14:00', enabled: false },
          sunday: { start: '10:00', end: '14:00', enabled: false },
        },
        bufferTime: {
          before: 15, // minutes
          after: 15, // minutes
        },
        appointmentTypes: [
          {
            id: 'appt_demo',
            name: 'Product Demo',
            duration: 60, // minutes
            price: 0,
            description: '30-minute product demonstration',
            isActive: true,
          },
          {
            id: 'appt_consultation',
            name: 'Sales Consultation',
            duration: 30,
            price: 0,
            description: 'Initial sales consultation',
            isActive: true,
          },
          {
            id: 'appt_followup',
            name: 'Follow-up Meeting',
            duration: 15,
            price: 0,
            description: 'Quick follow-up discussion',
            isActive: true,
          },
        ],
        integrations: {
          googleCalendar: {
            connected: true,
            calendarId: 'primary',
          },
          outlook: {
            connected: false,
          },
          zoom: {
            connected: true,
            meetingSettings: {
              autoRecord: false,
              joinBeforeHost: true,
            },
          },
        },
        bookingSettings: {
          allowDoubleBooking: false,
          minAdvanceBooking: 60, // minutes
          maxAdvanceBooking: 30, // days
          cancellationPolicy: {
            allowed: true,
            noticeRequired: 24, // hours
          },
          confirmationSettings: {
            autoConfirm: true,
            confirmationEmail: true,
            confirmationSms: false,
          },
        },
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isActive: true,
        locationId: 'loc_001',
        // Preserve all GHL calendar fields for forward compatibility
        customFields: {},
        analytics: {
          totalBookings: 450,
          averageRating: 4.8,
          noShowRate: 0.05,
        },
      },
      {
        id: 'cal_002',
        name: 'Support Calendar',
        description: 'Calendar for technical support sessions',
        type: 'support',
        timezone: 'America/New_York',
        workingHours: {
          monday: { start: '08:00', end: '18:00', enabled: true },
          tuesday: { start: '08:00', end: '18:00', enabled: true },
          wednesday: { start: '08:00', end: '18:00', enabled: true },
          thursday: { start: '08:00', end: '18:00', enabled: true },
          friday: { start: '08:00', end: '18:00', enabled: true },
          saturday: { start: '09:00', end: '15:00', enabled: true },
          sunday: { start: '09:00', end: '15:00', enabled: false },
        },
        bufferTime: {
          before: 10,
          after: 10,
        },
        appointmentTypes: [
          {
            id: 'appt_troubleshooting',
            name: 'Technical Support',
            duration: 45,
            price: 0,
            description: 'Technical troubleshooting session',
            isActive: true,
          },
          {
            id: 'appt_training',
            name: 'User Training',
            duration: 90,
            price: 0,
            description: 'Product training session',
            isActive: true,
          },
        ],
        integrations: {
          googleCalendar: {
            connected: true,
            calendarId: 'support@company.com',
          },
          zoom: {
            connected: true,
            meetingSettings: {
              autoRecord: true,
              joinBeforeHost: false,
            },
          },
        },
        bookingSettings: {
          allowDoubleBooking: false,
          minAdvanceBooking: 30,
          maxAdvanceBooking: 14,
          cancellationPolicy: {
            allowed: true,
            noticeRequired: 2,
          },
          confirmationSettings: {
            autoConfirm: false,
            confirmationEmail: true,
            confirmationSms: true,
          },
        },
        createdAt: '2023-02-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isActive: true,
        locationId: 'loc_002',
        customFields: {},
        analytics: {
          totalBookings: 180,
          averageRating: 4.6,
          noShowRate: 0.08,
        },
      },
    ];
  }
}
