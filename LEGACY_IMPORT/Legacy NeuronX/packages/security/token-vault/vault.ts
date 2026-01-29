// Core Token Vault Logic with Encryption Support

import {
  TokenRecord,
  TokenQuery,
  TokenCreateRequest,
  TokenUpdateRequest,
  TokenMetadata,
  TokenVaultStore,
  TokenVaultError,
  TokenExpiredError,
  TokenNotFoundError,
} from './types';

import {
  createKeyMaterial,
  loadKeyMaterial,
  encryptData,
  decryptData,
  encryptDataEncryptionKey,
  decryptDataEncryptionKey,
  validateMasterKey,
} from './crypto';

import { randomUUID } from 'crypto';

export class TokenVault {
  private masterKey: string;
  private currentKeyId: string;

  constructor(
    masterKey: string,
    currentKeyId: string,
    private store: TokenVaultStore
  ) {
    if (!validateMasterKey(masterKey)) {
      throw new TokenVaultError(
        'ENCRYPTION_ERROR',
        'Invalid master key format'
      );
    }

    this.masterKey = masterKey;
    this.currentKeyId = currentKeyId;
  }

  /**
   * Store a new token record
   */
  async storeToken(request: TokenCreateRequest): Promise<TokenRecord> {
    const keyMaterial = createKeyMaterial(this.masterKey, this.currentKeyId);

    // Encrypt sensitive data
    const encryptedAccessToken = encryptData(request.accessToken, keyMaterial);
    const encryptedRefreshToken = encryptData(
      request.refreshToken,
      keyMaterial
    );
    const encryptedDek = encryptDataEncryptionKey(
      keyMaterial.dataEncryptionKey,
      keyMaterial.keyEncryptionKey
    );

    const record: TokenRecord = {
      id: randomUUID(),
      tenantId: request.tenantId,
      provider: request.provider,
      environment: request.environment,
      locationId: request.locationId,
      encryptedAccessToken: JSON.stringify(encryptedAccessToken),
      encryptedRefreshToken: JSON.stringify(encryptedRefreshToken),
      encryptedDek,
      scope: request.scope,
      expiresAt: new Date(Date.now() + request.expiresIn * 1000),
      lastRefreshed: new Date(),
      keyId: this.currentKeyId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: request.createdBy,
    };

    await this.store.save(record);
    return record;
  }

  /**
   * Retrieve and decrypt a valid token
   */
  async getToken(query: TokenQuery): Promise<TokenRecord> {
    const record = await this.store.find(query);

    if (!record) {
      throw new TokenNotFoundError(query);
    }

    // Check if token is expired
    if (this.isTokenExpired(record)) {
      throw new TokenExpiredError(query.tenantId, query.provider);
    }

    // Decrypt if using old key version
    if (record.keyId !== this.currentKeyId) {
      const rotatedRecord = await this.rotateTokenEncryption(record);
      await this.store.save(rotatedRecord);
      return rotatedRecord;
    }

    return record;
  }

  /**
   * Get decrypted access token for API calls
   */
  async getAccessToken(query: TokenQuery): Promise<string> {
    const record = await this.getToken(query);

    try {
      const keyMaterial = loadKeyMaterial(
        this.masterKey,
        record.keyId,
        record.encryptedDek
      );

      const encryptedData = JSON.parse(record.encryptedAccessToken);
      return decryptData(encryptedData, keyMaterial);
    } catch (error) {
      throw new TokenVaultError(
        'DECRYPTION_ERROR',
        'Failed to decrypt access token',
        error
      );
    }
  }

  /**
   * Get decrypted refresh token for token refresh
   */
  async getRefreshToken(query: TokenQuery): Promise<string> {
    const record = await this.getToken(query);

    try {
      const keyMaterial = loadKeyMaterial(
        this.masterKey,
        record.keyId,
        record.encryptedDek
      );

      const encryptedData = JSON.parse(record.encryptedRefreshToken);
      return decryptData(encryptedData, keyMaterial);
    } catch (error) {
      throw new TokenVaultError(
        'DECRYPTION_ERROR',
        'Failed to decrypt refresh token',
        error
      );
    }
  }

  /**
   * Update token data (e.g., after refresh)
   */
  async updateToken(
    query: TokenQuery,
    updates: TokenUpdateRequest
  ): Promise<TokenRecord> {
    const existingRecord = await this.store.find(query);
    if (!existingRecord) {
      throw new TokenNotFoundError(query);
    }

    const updateData: Partial<TokenRecord> = {
      updatedAt: new Date(),
    };

    // Re-encrypt tokens if provided
    if (updates.accessToken || updates.refreshToken) {
      const keyMaterial = createKeyMaterial(this.masterKey, this.currentKeyId);

      if (updates.accessToken) {
        const encryptedAccessToken = encryptData(
          updates.accessToken,
          keyMaterial
        );
        updateData.encryptedAccessToken = JSON.stringify(encryptedAccessToken);
      }

      if (updates.refreshToken) {
        const encryptedRefreshToken = encryptData(
          updates.refreshToken,
          keyMaterial
        );
        updateData.encryptedRefreshToken = JSON.stringify(
          encryptedRefreshToken
        );
      }

      // Update encryption key data
      const encryptedDek = encryptDataEncryptionKey(
        keyMaterial.dataEncryptionKey,
        keyMaterial.keyEncryptionKey
      );
      updateData.encryptedDek = encryptedDek;
      updateData.keyId = this.currentKeyId;
    }

    // Update metadata
    if (updates.scope) updateData.scope = updates.scope;
    if (updates.expiresAt) updateData.expiresAt = updates.expiresAt;
    if (updates.lastRotatedBy) updateData.lastRotatedBy = updates.lastRotatedBy;

    return await this.store.update(existingRecord.id, updateData);
  }

  /**
   * Get token metadata without decrypting sensitive data
   */
  async getTokenMetadata(query: TokenQuery): Promise<TokenMetadata> {
    const record = await this.getToken(query);

    return {
      tenantId: record.tenantId,
      provider: record.provider,
      environment: record.environment,
      locationId: record.locationId,
      scope: record.scope,
      expiresAt: record.expiresAt,
      lastRefreshed: record.lastRefreshed,
      keyId: record.keyId,
    };
  }

  /**
   * List all tokens for a tenant
   */
  async listTenantTokens(tenantId: string): Promise<TokenMetadata[]> {
    const records = await this.store.findAll(tenantId);

    return records.map(record => ({
      tenantId: record.tenantId,
      provider: record.provider,
      environment: record.environment,
      locationId: record.locationId,
      scope: record.scope,
      expiresAt: record.expiresAt,
      lastRefreshed: record.lastRefreshed,
      keyId: record.keyId,
    }));
  }

  /**
   * Remove a token
   */
  async removeToken(query: TokenQuery): Promise<void> {
    const record = await this.store.find(query);
    if (record) {
      await this.store.delete(record.id);
    }
  }

  /**
   * Check if token is expired (with buffer)
   */
  private isTokenExpired(record: TokenRecord): boolean {
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    return record.expiresAt.getTime() < Date.now() + bufferTime;
  }

  /**
   * Rotate encryption for a token record to current key
   */
  private async rotateTokenEncryption(
    record: TokenRecord
  ): Promise<TokenRecord> {
    try {
      // Load old key material
      const oldKeyMaterial = loadKeyMaterial(
        this.masterKey,
        record.keyId,
        record.encryptedDek
      );

      // Decrypt with old key
      const accessToken = decryptData(
        JSON.parse(record.encryptedAccessToken),
        oldKeyMaterial
      );
      const refreshToken = decryptData(
        JSON.parse(record.encryptedRefreshToken),
        oldKeyMaterial
      );

      // Create new key material
      const newKeyMaterial = createKeyMaterial(
        this.masterKey,
        this.currentKeyId
      );

      // Re-encrypt with new key
      const newEncryptedAccessToken = encryptData(accessToken, newKeyMaterial);
      const newEncryptedRefreshToken = encryptData(
        refreshToken,
        newKeyMaterial
      );
      const newEncryptedDek = encryptDataEncryptionKey(
        newKeyMaterial.dataEncryptionKey,
        newKeyMaterial.keyEncryptionKey
      );

      return {
        ...record,
        encryptedAccessToken: JSON.stringify(newEncryptedAccessToken),
        encryptedRefreshToken: JSON.stringify(newEncryptedRefreshToken),
        encryptedDek: newEncryptedDek,
        keyId: this.currentKeyId,
        updatedAt: new Date(),
        lastRotatedBy: 'key_rotation',
      };
    } catch (error) {
      throw new TokenVaultError(
        'ENCRYPTION_ERROR',
        'Failed to rotate token encryption',
        error
      );
    }
  }

  /**
   * Rotate all tokens to new key version (for key rotation)
   */
  async rotateAllKeys(newKeyId: string): Promise<number> {
    const rotatedCount = await this.store.rotateKey(
      this.currentKeyId,
      newKeyId
    );
    this.currentKeyId = newKeyId;
    return rotatedCount;
  }

  /**
   * Validate token scope requirements
   */
  async validateTokenScope(
    query: TokenQuery,
    requiredScopes: string[]
  ): Promise<boolean> {
    const record = await this.getToken(query);
    return requiredScopes.every(scope => record.scope.includes(scope));
  }
}
