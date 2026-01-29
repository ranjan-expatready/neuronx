# Secrets & Encryption Foundation - WI-019

**Purpose:** Secure, production-grade secret management for NeuronX. Eliminates plaintext secret storage in runtime databases while providing rotation, audit, and multi-tenant isolation.

## Secret Lifecycle

### Secret States

- **ACTIVE:** Current secret used for signing/verification
- **PREVIOUS:** Previous secret retained for overlap window during rotation
- **RETIRED:** Secret no longer valid, retained for audit only

### Secret Rotation Rules

- **Rotation Trigger:** Manual admin action or scheduled (30 days max)
- **Overlap Window:** 24 hours (configurable)
- **Backward Compatibility:** Previous secret remains valid during overlap
- **Cleanup:** Retired secrets retained 90 days for audit, then deleted
- **Audit:** All rotations logged with actor, timestamp, correlationId

### Secret References (secretRef)

Format: `{provider}:{tenantId}:{name}:{version}`

- `provider`: `db` | `aws` | `gcp` | `dev`
- `tenantId`: Tenant isolation identifier
- `name`: Secret name (e.g., `webhook-endpoint-{endpointId}`)
- `version`: Numeric version (1, 2, 3...)

Examples:

- `db:tenant-a:webhook-endpoint-ep123:1`
- `aws:tenant-b:webhook-endpoint-ep456:2`
- `dev:tenant-c:webhook-endpoint-ep789:1`

## Environment Contracts

### Required Environment Variables

```bash
# Secret Storage Provider
SECRETS_PROVIDER="db" | "aws" | "gcp" | "dev"

# DB Provider (when SECRETS_PROVIDER=db)
SECRETS_MASTER_KEY="base64-encoded-32-byte-key-for-aes-256-gcm"

# AWS Provider (when SECRETS_PROVIDER=aws)
AWS_REGION="us-east-1"
AWS_SECRET_MANAGER_ROLE_ARN="arn:aws:iam::123456789012:role/neuronx-secrets-role"

# GCP Provider (when SECRETS_PROVIDER=gcp)
GOOGLE_CLOUD_PROJECT="neuronx-project"
GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"

# Dev Provider (when SECRETS_PROVIDER=dev)
# No additional variables - uses in-memory storage
```

### Provider Selection Logic

```typescript
const provider = process.env.SECRETS_PROVIDER || 'dev';

switch (provider) {
  case 'db':
    // Use EnvelopeEncryptedDbSecretStore
    requireMasterKey();
    break;
  case 'aws':
    // Use ExternalSecretManagerStore with AWS driver
    break;
  case 'gcp':
    // Use ExternalSecretManagerStore with GCP driver
    break;
  case 'dev':
    // Use EnvVaultSecretStore (DEV ONLY)
    break;
  default:
    throw new Error(`Unknown secrets provider: ${provider}`);
}
```

## Secret Store Interface

### Core Interface

```typescript
interface SecretStore {
  // Store a new secret
  putSecret(
    tenantId: string,
    name: string,
    value: string,
    metadata?: any
  ): Promise<string>;

  // Retrieve active secret
  getSecret(tenantId: string, secretRef: string): Promise<string>;

  // Rotate secret (creates new version, keeps previous)
  rotateSecret(
    tenantId: string,
    name: string,
    newValue: string,
    actor: string,
    correlationId?: string
  ): Promise<string>;

  // List secret versions for audit
  listSecretVersions(tenantId: string, name: string): Promise<SecretVersion[]>;
}

interface SecretVersion {
  secretRef: string;
  status: 'ACTIVE' | 'PREVIOUS' | 'RETIRED';
  createdAt: Date;
  rotatedAt?: Date;
  retiredAt?: Date;
}
```

### Provider Implementations

#### EnvVaultSecretStore (DEV ONLY)

- **Purpose:** Development-only in-memory storage
- **Security:** NO encryption, process-lifetime only
- **Usage:** `SECRETS_PROVIDER=dev`
- **WARNING:** Must never be used in production

#### EnvelopeEncryptedDbSecretStore (Fallback)

- **Purpose:** Database-backed with envelope encryption
- **Encryption:** AES-256-GCM with per-secret nonce
- **Master Key:** From `SECRETS_MASTER_KEY` environment variable
- **Storage:** `SecretRecord` table with ciphertext + metadata
- **Usage:** `SECRETS_PROVIDER=db`

#### ExternalSecretManagerStore (Production)

- **Purpose:** External secret manager integration
- **Providers:** AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault
- **Security:** Full external security model
- **Usage:** `SECRETS_PROVIDER=aws|gcp|vault`

## Database Schema (DB Fallback)

### SecretRecord Table

```sql
model SecretRecord {
  id                String   @id @default(cuid())

  // Tenant isolation
  tenantId          String

  // Secret identity
  name              String   // e.g., "webhook-endpoint-ep123"
  version           Int      // Version number (1, 2, 3...)

  // Encryption
  ciphertext        String   // Base64-encoded encrypted secret
  nonce             String   // Base64-encoded nonce for AES-GCM
  keyVersion        String   // Master key version (for key rotation)

  // Status lifecycle
  status            String   @default("ACTIVE") // ACTIVE | PREVIOUS | RETIRED

  // Audit
  createdAt         DateTime @default(now())
  rotatedAt         DateTime?
  retiredAt         DateTime?

  // Constraints
  @@unique([tenantId, name, status]) // Only one ACTIVE/PREVIOUS per name
  @@unique([tenantId, name, version]) // Version uniqueness

  // Indexes
  @@index([tenantId, name]) // Secret lookup
  @@index([tenantId, status]) // Active secrets listing
  @@index([status, createdAt]) // Cleanup queries
  @@map("secret_records")
}
```

### WebhookEndpoint Schema Updates

```sql
model WebhookEndpoint {
  // ... existing fields ...

  // Secret management (replaces plaintext secret)
  secretRef         String?  // Reference to secret store
  previousSecretRef String?  // Previous version during rotation
  secretProvider    String   @default("db") // db | aws | gcp | dev
  secretUpdatedAt   DateTime @default(now())

  // Remove: secret String (plaintext - NO LONGER ALLOWED)

  // ... existing constraints and indexes ...
}
```

## Encryption Implementation (DB Fallback)

### AES-256-GCM Encryption

```typescript
import { createCipherGCM, createDecipherGCM } from 'crypto';

class EnvelopeEncryptedDbSecretStore implements SecretStore {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits

  constructor(private readonly masterKeyBase64: string) {
    this.masterKey = Buffer.from(masterKeyBase64, 'base64');
    if (this.masterKey.length !== this.keyLength) {
      throw new Error('Master key must be 32 bytes (256 bits)');
    }
  }

  async encryptSecret(
    value: string
  ): Promise<{ ciphertext: string; nonce: string }> {
    const nonce = crypto.randomBytes(12); // 96-bit nonce for GCM
    const cipher = createCipherGCM(this.algorithm, this.masterKey, nonce);

    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Combine encrypted data + auth tag
    const ciphertext = Buffer.concat([encrypted, authTag]);

    return {
      ciphertext: ciphertext.toString('base64'),
      nonce: nonce.toString('base64'),
    };
  }

  async decryptSecret(
    ciphertextBase64: string,
    nonceBase64: string
  ): Promise<string> {
    const ciphertext = Buffer.from(ciphertextBase64, 'base64');
    const nonce = Buffer.from(nonceBase64, 'base64');

    // Extract auth tag (last 16 bytes)
    const authTag = ciphertext.subarray(-16);
    const encrypted = ciphertext.subarray(0, -16);

    const decipher = createDecipherGCM(this.algorithm, this.masterKey, nonce);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
```

## Secret Service Wrapper

### Caching and Fail-Closed Semantics

```typescript
@Injectable()
export class SecretService {
  private readonly cache = new Map<
    string,
    { value: string; expiresAt: number }
  >();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly secretStore: SecretStore) {}

  async getSecret(secretRef: string): Promise<string> {
    const cacheKey = secretRef;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const value = await this.secretStore.getSecret(secretRef);
      this.cache.set(cacheKey, {
        value,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
      return value;
    } catch (error) {
      // FAIL-CLOSED: Never return cached value on error
      this.cache.delete(cacheKey);
      throw error;
    }
  }

  async putSecret(
    tenantId: string,
    name: string,
    value: string
  ): Promise<string> {
    const secretRef = await this.secretStore.putSecret(tenantId, name, value);
    // Invalidate cache for this secret
    this.cache.delete(secretRef);
    return secretRef;
  }

  async rotateSecret(
    tenantId: string,
    name: string,
    newValue: string,
    actor: string,
    correlationId?: string
  ): Promise<string> {
    const newSecretRef = await this.secretStore.rotateSecret(
      tenantId,
      name,
      newValue,
      actor,
      correlationId
    );
    // Clear all cache entries for this secret name
    for (const [key] of this.cache) {
      if (key.includes(`${tenantId}:${name}`)) {
        this.cache.delete(key);
      }
    }
    return newSecretRef;
  }
}
```

## Migration Strategy

### One-Time Migration for Existing Secrets

```typescript
async migrateWebhookSecrets(): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      secret: { not: null },
      secretRef: null, // Not already migrated
    }
  });

  for (const endpoint of endpoints) {
    if (!endpoint.secret) continue;

    // Store secret in SecretStore
    const secretRef = await secretService.putSecret(
      endpoint.tenantId,
      `webhook-endpoint-${endpoint.id}`,
      endpoint.secret
    );

    // Update endpoint to use secretRef
    await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: {
        secretRef,
        secretProvider: process.env.SECRETS_PROVIDER || 'db',
        secretUpdatedAt: new Date(),
        secret: null, // Clear plaintext
      }
    });

    logger.info(`Migrated webhook endpoint ${endpoint.id} secret`, {
      tenantId: endpoint.tenantId,
      secretRef
    });
  }
}
```

### Runtime Safety Guards

```typescript
// In webhook signer - production safety check
async getWebhookSecret(endpoint: WebhookEndpoint): Promise<string> {
  if (process.env.NODE_ENV === 'production' && endpoint.secret) {
    throw new Error('Plaintext webhook secrets not allowed in production');
  }

  if (endpoint.secretRef) {
    return await secretService.getSecret(endpoint.secretRef);
  }

  if (endpoint.secret && process.env.NODE_ENV !== 'production') {
    return endpoint.secret; // Legacy support for dev
  }

  throw new Error('No webhook secret available');
}
```

## Security Considerations

### Key Management

- **Master Key:** Stored as environment variable, never in code/config files
- **Key Rotation:** Master key rotation requires re-encryption of all secrets
- **Handoff:** Keys managed separately from application deployment

### Audit Requirements

- **Secret Access:** All secret retrievals logged with tenantId, actor, correlationId
- **Rotation Events:** All rotations audited with before/after references
- **Failure Events:** Failed access attempts logged for security monitoring

### Compliance

- **Encryption at Rest:** AES-256-GCM for DB fallback
- **Encryption in Transit:** HTTPS required for external providers
- **Access Control:** Tenant isolation enforced at all layers
- **Retention:** Secrets retained per compliance requirements

## Integration Points

### Webhook Signing (WI-018 Integration)

```typescript
// Updated webhook signer
async signPayload(payload: WebhookPayload, endpoint: WebhookEndpoint, timestamp: string): Promise<string> {
  const secret = await this.secretService.getSecret(endpoint.secretRef!);

  const jsonBody = JSON.stringify(payload, Object.keys(payload).sort());
  const content = `${timestamp}.${jsonBody}`;

  const hmac = createHmac('sha256', secret);
  hmac.update(content);
  const signature = hmac.digest('hex');

  return `sha256=${signature}`;
}
```

### Admin Controls (Future WI)

- **Secret Rotation:** Admin endpoint to trigger rotation
- **Secret Audit:** List secret versions and access history
- **Emergency Controls:** Kill switch for secret access

## Testing Strategy

### Unit Tests

- **Encryption/Decryption:** AES-256-GCM correctness
- **HMAC Signing:** Signature verification with rotated secrets
- **Caching:** TTL behavior and cache invalidation
- **Provider Selection:** Environment-based provider loading

### Integration Tests

- **Webhook Delivery:** End-to-end signing with secret store
- **Rotation:** Secret rotation preserves backward compatibility
- **Migration:** Existing secrets properly migrated
- **Fail-Closed:** Errors never return cached values

### Security Tests

- **Tamper Detection:** Modified ciphertext rejected
- **Key Separation:** Different master keys produce different ciphertexts
- **Timing Attacks:** Constant-time operations where applicable

## Environment Setup

### Development

```bash
export SECRETS_PROVIDER=dev
# No additional setup - uses in-memory storage
```

### Production (DB Fallback)

```bash
export SECRETS_PROVIDER=db
export SECRETS_MASTER_KEY="$(openssl rand -base64 32)"
```

### Production (AWS)

```bash
export SECRETS_PROVIDER=aws
export AWS_REGION=us-east-1
export AWS_SECRET_MANAGER_ROLE_ARN=arn:aws:iam::123456789012:role/neuronx-secrets-role
```

## Migration Timeline

### Phase 1: Implementation (WI-019)

- Implement secret store abstraction
- Add DB schema and encryption
- Update webhook endpoints to use secretRef
- Create migration script

### Phase 2: Deployment

- Deploy with backward compatibility
- Run migration in maintenance window
- Monitor for secret access errors

### Phase 3: Cleanup (30 days later)

- Remove legacy secret field from schema
- Update all references to use secretRef only
- Remove backward compatibility code

## Error Handling

### Secret Access Failures

- **Cache Miss:** Retry with backoff, then fail closed
- **Provider Unavailable:** Log error, return 500 for dependent operations
- **Invalid Reference:** Log security event, return 404 equivalent

### Migration Errors

- **Duplicate Migration:** Skip with warning
- **Secret Store Failure:** Rollback transaction, alert admin
- **Schema Inconsistency:** Manual intervention required

---

**Status:** Canonical contract for WI-019 implementation
**Security:** NO plaintext secrets in production database
**Compliance:** Audit trails and rotation support
**Backward Compatibility:** Migration path from legacy secrets
