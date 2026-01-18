// Token Vault Types

export interface TokenRecord {
  id: string; // Unique record identifier
  tenantId: string; // NeuronX tenant ID
  provider: string; // 'ghl', 'salesforce', etc.
  environment: 'dev' | 'stage' | 'prod';
  locationId?: string; // Provider-specific location/account ID

  // Encrypted token data
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  encryptedDek: string; // Encrypted data encryption key

  // Metadata
  scope: string[]; // OAuth scopes
  expiresAt: Date; // When access token expires
  lastRefreshed: Date; // Last successful refresh
  keyId: string; // Encryption key version

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // User/system that created
  lastRotatedBy?: string; // What triggered last rotation
}

export interface TokenQuery {
  tenantId: string;
  provider: string;
  environment: 'dev' | 'stage' | 'prod';
  locationId?: string;
}

export interface TokenCreateRequest {
  tenantId: string;
  provider: string;
  environment: 'dev' | 'stage' | 'prod';
  locationId?: string;
  accessToken: string;
  refreshToken: string;
  scope: string[];
  expiresIn: number; // seconds
  createdBy?: string;
}

export interface TokenUpdateRequest {
  accessToken?: string;
  refreshToken?: string;
  scope?: string[];
  expiresAt?: Date;
  lastRotatedBy?: string;
}

export interface TokenMetadata {
  tenantId: string;
  provider: string;
  environment: string;
  locationId?: string;
  scope: string[];
  expiresAt: Date;
  lastRefreshed: Date;
  keyId: string;
}

// Database model (for Prisma/PostgreSQL)
export interface TokenCredentialModel {
  id: string;
  tenantId: string;
  provider: string;
  environment: string;
  locationId?: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  encryptedDek: string;
  scope: string[]; // PostgreSQL text array
  expiresAt: Date;
  lastRefreshed: Date;
  keyId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  lastRotatedBy?: string;
}

// Store interface for persistence abstraction
export interface TokenVaultStore {
  save(record: TokenRecord): Promise<void>;
  find(query: TokenQuery): Promise<TokenRecord | null>;
  findAll(tenantId: string): Promise<TokenRecord[]>;
  update(id: string, updates: TokenUpdateRequest): Promise<TokenRecord>;
  delete(id: string): Promise<void>;
  rotateKey(oldKeyId: string, newKeyId: string): Promise<number>; // Returns count of rotated records
}

// Error types
export class TokenVaultError extends Error {
  constructor(
    public code:
      | 'NOT_FOUND'
      | 'ENCRYPTION_ERROR'
      | 'DECRYPTION_ERROR'
      | 'STORE_ERROR',
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'TokenVaultError';
  }
}

export class TokenExpiredError extends TokenVaultError {
  constructor(tenantId: string, provider: string) {
    super(
      'NOT_FOUND',
      `Token expired for tenant ${tenantId}, provider ${provider}`
    );
  }
}

export class TokenNotFoundError extends TokenVaultError {
  constructor(query: TokenQuery) {
    super('NOT_FOUND', `Token not found for query: ${JSON.stringify(query)}`);
  }
}
