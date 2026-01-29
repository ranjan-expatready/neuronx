/**
 * Version Pinning Manager - WI-030: Playbook Versioning & Governance
 *
 * Manages version pinning for specific opportunities to ensure consistency.
 */

import { VersionPin, PlaybookVersion } from './types';

/**
 * Manages version pinning for opportunities
 */
export class VersionPinningManager {
  private pins = new Map<string, VersionPin>();

  /**
   * Generate pin key for internal storage
   */
  private getPinKey(
    tenantId: string,
    opportunityId: string,
    playbookId: string
  ): string {
    return `${tenantId}:${opportunityId}:${playbookId}`;
  }

  /**
   * Create a version pin for an opportunity
   */
  pinVersion(
    tenantId: string,
    opportunityId: string,
    playbookId: string,
    version: string,
    pinnedBy: string,
    reason: string,
    expiresAt?: Date,
    autoRenew = false,
    renewalCondition?: string
  ): VersionPin {
    const pinKey = this.getPinKey(tenantId, opportunityId, playbookId);

    // Check if already pinned
    const existingPin = this.pins.get(pinKey);
    if (existingPin && !existingPin.expiresAt) {
      throw new Error(
        `Opportunity ${opportunityId} is already pinned to version ${existingPin.pinnedVersion}`
      );
    }

    const pin: VersionPin = {
      tenantId,
      opportunityId,
      playbookId,
      pinnedVersion: version,
      pinnedBy,
      pinnedAt: new Date(),
      reason,
      expiresAt,
      autoRenew,
      renewalCondition,
    };

    this.pins.set(pinKey, pin);
    return pin;
  }

  /**
   * Get pinned version for an opportunity
   */
  getPinnedVersion(
    tenantId: string,
    opportunityId: string,
    playbookId: string
  ): VersionPin | null {
    const pinKey = this.getPinKey(tenantId, opportunityId, playbookId);
    const pin = this.pins.get(pinKey);

    if (!pin) {
      return null;
    }

    // Check if pin has expired
    if (pin.expiresAt && pin.expiresAt < new Date()) {
      // Auto-renew if configured
      if (pin.autoRenew && this.shouldRenew(pin)) {
        return this.renewPin(pin);
      }

      // Remove expired pin
      this.pins.delete(pinKey);
      return null;
    }

    return pin;
  }

  /**
   * Check if pin should be auto-renewed
   */
  private shouldRenew(pin: VersionPin): boolean {
    if (!pin.renewalCondition) {
      return false;
    }

    // Simplified renewal logic - in production, this would evaluate conditions
    // like "if opportunity is still in early stages" or "if no issues reported"
    return pin.renewalCondition === 'auto_renew_safe';
  }

  /**
   * Renew an expired pin
   */
  private renewPin(pin: VersionPin): VersionPin {
    const renewedPin: VersionPin = {
      ...pin,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      pinnedAt: new Date(),
    };

    const pinKey = this.getPinKey(
      pin.tenantId,
      pin.opportunityId,
      pin.playbookId
    );
    this.pins.set(pinKey, renewedPin);

    return renewedPin;
  }

  /**
   * Unpin a version for an opportunity
   */
  unpinVersion(
    tenantId: string,
    opportunityId: string,
    playbookId: string,
    unpinnedBy: string
  ): boolean {
    const pinKey = this.getPinKey(tenantId, opportunityId, playbookId);
    const pin = this.pins.get(pinKey);

    if (!pin) {
      return false;
    }

    // Log unpinning action (would be stored in audit log in real implementation)
    console.log(
      `Version pin removed for opportunity ${opportunityId} by ${unpinnedBy}`
    );

    this.pins.delete(pinKey);
    return true;
  }

  /**
   * Get all pins for a tenant
   */
  getTenantPins(tenantId: string): VersionPin[] {
    const tenantPins: VersionPin[] = [];

    for (const pin of this.pins.values()) {
      if (pin.tenantId === tenantId) {
        // Check for expiration
        if (pin.expiresAt && pin.expiresAt < new Date()) {
          if (pin.autoRenew && this.shouldRenew(pin)) {
            tenantPins.push(this.renewPin(pin));
          }
          // Else pin is expired, don't include
        } else {
          tenantPins.push(pin);
        }
      }
    }

    return tenantPins;
  }

  /**
   * Get all pins for a playbook
   */
  getPlaybookPins(playbookId: string, tenantId?: string): VersionPin[] {
    const playbookPins: VersionPin[] = [];

    for (const pin of this.pins.values()) {
      if (
        pin.playbookId === playbookId &&
        (!tenantId || pin.tenantId === tenantId)
      ) {
        // Check for expiration
        if (pin.expiresAt && pin.expiresAt < new Date()) {
          if (pin.autoRenew && this.shouldRenew(pin)) {
            playbookPins.push(this.renewPin(pin));
          }
          // Else pin is expired, don't include
        } else {
          playbookPins.push(pin);
        }
      }
    }

    return playbookPins;
  }

  /**
   * Extend pin expiration
   */
  extendPin(
    tenantId: string,
    opportunityId: string,
    playbookId: string,
    newExpiry: Date,
    extendedBy: string
  ): VersionPin | null {
    const pinKey = this.getPinKey(tenantId, opportunityId, playbookId);
    const pin = this.pins.get(pinKey);

    if (!pin) {
      return null;
    }

    const extendedPin: VersionPin = {
      ...pin,
      expiresAt: newExpiry,
      pinnedAt: new Date(), // Update last modified time
    };

    this.pins.set(pinKey, extendedPin);
    return extendedPin;
  }

  /**
   * Get version to use for decision-making
   * Returns pinned version if available, otherwise active version
   */
  getEffectiveVersion(
    opportunityId: string,
    playbookId: string,
    tenantId: string,
    activeVersion: PlaybookVersion | null
  ): {
    version: PlaybookVersion | null;
    isPinned: boolean;
    pinReason?: string;
  } {
    const pin = this.getPinnedVersion(tenantId, opportunityId, playbookId);

    if (pin) {
      // In real implementation, would fetch the specific pinned version from registry
      // For now, return active version with pin info
      return {
        version: activeVersion,
        isPinned: true,
        pinReason: pin.reason,
      };
    }

    return {
      version: activeVersion,
      isPinned: false,
    };
  }

  /**
   * Check if an opportunity can transition to a new version
   */
  canTransitionToVersion(
    opportunityId: string,
    playbookId: string,
    tenantId: string,
    targetVersion: string,
    currentStage?: string
  ): { canTransition: boolean; reason: string } {
    const pin = this.getPinnedVersion(tenantId, opportunityId, playbookId);

    if (pin) {
      if (pin.pinnedVersion === targetVersion) {
        return {
          canTransition: true,
          reason: 'Already pinned to target version',
        };
      } else {
        return {
          canTransition: false,
          reason: `Opportunity is pinned to version ${pin.pinnedVersion} until ${pin.expiresAt?.toISOString() || 'manually unpinned'}`,
        };
      }
    }

    // Additional logic could check if transition is safe based on current stage
    // For example, don't allow major version jumps mid-opportunity

    return { canTransition: true, reason: 'No pinning constraints' };
  }

  /**
   * Clean up expired pins (maintenance operation)
   */
  cleanupExpiredPins(): number {
    let cleanedCount = 0;

    for (const [pinKey, pin] of this.pins.entries()) {
      if (pin.expiresAt && pin.expiresAt < new Date() && !pin.autoRenew) {
        this.pins.delete(pinKey);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}
