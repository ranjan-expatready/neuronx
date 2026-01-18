/**
 * Calendar Drift Detector - WI-053: Drift Detection Engine
 *
 * Detects drift in GHL calendar configurations.
 */

import { Injectable } from '@nestjs/common';
import { BaseDriftDetector } from './base-drift.detector';
import { DriftChange, DriftChangeType } from '../drift-types';

@Injectable()
export class CalendarDriftDetector extends BaseDriftDetector {
  /**
   * Detect drift in calendar snapshots
   */
  async detectDrift(
    beforeSnapshot: any,
    afterSnapshot: any,
    context: { tenantId: string; ghlAccountId: string; correlationId: string }
  ): Promise<DriftChange[]> {
    const beforeCalendars = beforeSnapshot.payload?.data || [];
    const afterCalendars = afterSnapshot.payload?.data || [];

    const changes: DriftChange[] = [];

    // First, detect calendar-level changes
    changes.push(
      ...this.detectEntityChanges(beforeCalendars, afterCalendars, 'calendar')
    );

    // Then, detect nested configuration changes
    const beforeCalendarMap = this.createEntityMap(beforeCalendars);
    const afterCalendarMap = this.createEntityMap(afterCalendars);

    for (const [calendarId, beforeCalendar] of beforeCalendarMap) {
      const afterCalendar = afterCalendarMap.get(calendarId);
      if (afterCalendar) {
        // Calendar exists in both - check nested configurations
        const nestedChanges = this.detectNestedCalendarChanges(
          beforeCalendar,
          afterCalendar,
          calendarId
        );
        changes.push(...nestedChanges);
      }
    }

    return changes;
  }

  /**
   * Detect changes in nested calendar configurations
   */
  private detectNestedCalendarChanges(
    beforeCalendar: any,
    afterCalendar: any,
    calendarId: string
  ): DriftChange[] {
    const changes: DriftChange[] = [];

    // Check working hours changes
    if (beforeCalendar.workingHours || afterCalendar.workingHours) {
      const workingHoursChanges = this.detectWorkingHoursChanges(
        beforeCalendar.workingHours,
        afterCalendar.workingHours,
        calendarId
      );
      changes.push(...workingHoursChanges);
    }

    // Check appointment types changes
    if (beforeCalendar.appointmentTypes || afterCalendar.appointmentTypes) {
      const appointmentTypeChanges = this.detectAppointmentTypesChanges(
        beforeCalendar.appointmentTypes || [],
        afterCalendar.appointmentTypes || [],
        calendarId
      );
      changes.push(...appointmentTypeChanges);
    }

    // Check booking settings changes
    if (beforeCalendar.bookingSettings || afterCalendar.bookingSettings) {
      const bookingSettingsChanges = this.detectFieldChanges(
        beforeCalendar.bookingSettings || {},
        afterCalendar.bookingSettings || {},
        `calendar[${calendarId}].bookingSettings`
      );

      for (const change of bookingSettingsChanges) {
        change.entityId = calendarId;
        change.entityType = 'calendar_booking_settings';
      }

      changes.push(...bookingSettingsChanges);
    }

    return changes;
  }

  /**
   * Detect changes in working hours
   */
  private detectWorkingHoursChanges(
    beforeHours: any,
    afterHours: any,
    calendarId: string
  ): DriftChange[] {
    const changes: DriftChange[] = [];

    const days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];

    for (const day of days) {
      const beforeDayHours = beforeHours?.[day];
      const afterDayHours = afterHours?.[day];

      if (!this.valuesEqual(beforeDayHours, afterDayHours)) {
        changes.push(
          this.createDriftChange(
            DriftChangeType.MODIFIED,
            calendarId,
            'calendar_working_hours',
            `calendar[${calendarId}].workingHours.${day}`,
            beforeDayHours,
            afterDayHours,
            `Working hours for ${day} changed in calendar '${calendarId}'`
          )
        );
      }
    }

    return changes;
  }

  /**
   * Detect changes in appointment types
   */
  private detectAppointmentTypesChanges(
    beforeTypes: any[],
    afterTypes: any[],
    calendarId: string
  ): DriftChange[] {
    return this.detectEntityChanges(
      beforeTypes,
      afterTypes,
      'calendar_appointment_type',
      'id'
    ).map(change => ({
      ...change,
      diffPath: `calendar[${calendarId}].appointmentTypes.${change.diffPath}`,
      description: change.description.replace(
        'calendar_appointment_type',
        `appointment type in calendar '${calendarId}'`
      ),
    }));
  }
}
