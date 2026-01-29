/**
 * Secret Reference Tests - WI-019: Secrets & Encryption Foundation
 *
 * Tests for secret reference parsing, formatting, and validation.
 */

import { SecretRef, SecretRefParseError } from '../secret-ref';

describe('SecretRef', () => {
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const name = 'webhook-endpoint-ep123';
  const version = 2;

  describe('parse', () => {
    it('should parse valid secret reference', () => {
      const secretRef = `db:${tenantA}:${name}:${version}`;
      const parsed = SecretRef.parse(secretRef);

      expect(parsed).toEqual({
        provider: 'db',
        tenantId: tenantA,
        name,
        version,
      });
    });

    it('should parse all provider types', () => {
      const providers = ['db', 'aws', 'gcp', 'dev'];

      for (const provider of providers) {
        const secretRef = `${provider}:${tenantA}:${name}:${version}`;
        const parsed = SecretRef.parse(secretRef);

        expect(parsed.provider).toBe(provider);
        expect(parsed.tenantId).toBe(tenantA);
        expect(parsed.name).toBe(name);
        expect(parsed.version).toBe(version);
      }
    });

    it('should reject invalid format - too few parts', () => {
      expect(() => SecretRef.parse(`db:${tenantA}:${name}`)).toThrow(SecretRefParseError);
      expect(() => SecretRef.parse(`${tenantA}:${name}:${version}`)).toThrow(SecretRefParseError);
    });

    it('should reject invalid format - too many parts', () => {
      expect(() => SecretRef.parse(`db:${tenantA}:${name}:${version}:extra`)).toThrow(SecretRefParseError);
    });

    it('should reject invalid provider', () => {
      expect(() => SecretRef.parse(`invalid:${tenantA}:${name}:${version}`)).toThrow(SecretRefParseError);
    });

    it('should reject non-numeric version', () => {
      expect(() => SecretRef.parse(`db:${tenantA}:${name}:abc`)).toThrow(SecretRefParseError);
    });

    it('should reject zero version', () => {
      expect(() => SecretRef.parse(`db:${tenantA}:${name}:0`)).toThrow(SecretRefParseError);
    });

    it('should reject negative version', () => {
      expect(() => SecretRef.parse(`db:${tenantA}:${name}:-1`)).toThrow(SecretRefParseError);
    });

    it('should reject empty tenant ID', () => {
      expect(() => SecretRef.parse(`db::${name}:${version}`)).toThrow(SecretRefParseError);
    });

    it('should reject empty name', () => {
      expect(() => SecretRef.parse(`db:${tenantA}::${version}`)).toThrow(SecretRefParseError);
    });
  });

  describe('format', () => {
    it('should format secret reference components', () => {
      const ref = {
        provider: 'db' as const,
        tenantId: tenantA,
        name,
        version,
      };

      const formatted = SecretRef.format(ref);
      expect(formatted).toBe(`db:${tenantA}:${name}:${version}`);
    });
  });

  describe('create', () => {
    it('should create secret reference with default version', () => {
      const secretRef = SecretRef.create('aws', tenantA, name);
      expect(secretRef).toBe(`aws:${tenantA}:${name}:1`);
    });

    it('should create secret reference with specified version', () => {
      const secretRef = SecretRef.create('gcp', tenantA, name, 5);
      expect(secretRef).toBe(`gcp:${tenantA}:${name}:5`);
    });
  });

  describe('nextVersion', () => {
    it('should increment version number', () => {
      const current = `db:${tenantA}:${name}:3`;
      const next = SecretRef.nextVersion(current);
      expect(next).toBe(`db:${tenantA}:${name}:4`);
    });
  });

  describe('validateTenant', () => {
    it('should validate matching tenant', () => {
      const secretRef = `db:${tenantA}:${name}:${version}`;
      expect(SecretRef.validateTenant(secretRef, tenantA)).toBe(true);
    });

    it('should reject non-matching tenant', () => {
      const secretRef = `db:${tenantA}:${name}:${version}`;
      expect(SecretRef.validateTenant(secretRef, tenantB)).toBe(false);
    });

    it('should reject invalid secret reference', () => {
      expect(SecretRef.validateTenant('invalid', tenantA)).toBe(false);
    });
  });

  describe('getTenantId', () => {
    it('should extract tenant ID', () => {
      const secretRef = `db:${tenantA}:${name}:${version}`;
      expect(SecretRef.getTenantId(secretRef)).toBe(tenantA);
    });

    it('should throw on invalid reference', () => {
      expect(() => SecretRef.getTenantId('invalid')).toThrow(SecretRefParseError);
    });
  });

  describe('getName', () => {
    it('should extract secret name', () => {
      const secretRef = `db:${tenantA}:${name}:${version}`;
      expect(SecretRef.getName(secretRef)).toBe(name);
    });
  });

  describe('getVersion', () => {
    it('should extract version', () => {
      const secretRef = `db:${tenantA}:${name}:${version}`;
      expect(SecretRef.getVersion(secretRef)).toBe(version);
    });
  });
});

