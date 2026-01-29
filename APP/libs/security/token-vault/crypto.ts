import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
} from 'crypto';

// Envelope encryption for token vault
// Uses AES-256-GCM with derived keys from master key

export interface EncryptedData {
  encrypted: string; // Base64 encrypted data
  iv: string; // Base64 initialization vector
  tag: string; // Base64 authentication tag
  keyId: string; // Key version for rotation
}

export interface KeyMaterial {
  keyEncryptionKey: Buffer; // KEK for encrypting DEKs
  dataEncryptionKey: Buffer; // DEK for encrypting data
  keyId: string;
}

/**
 * Derive key encryption key (KEK) from master key
 */
export function deriveKeyEncryptionKey(
  masterKey: string,
  keyId: string
): Buffer {
  const salt = Buffer.from(keyId, 'utf8');
  return scryptSync(masterKey, salt, 32); // 256-bit key
}

/**
 * Generate a new data encryption key (DEK)
 */
export function generateDataEncryptionKey(): Buffer {
  return randomBytes(32); // 256-bit key
}

/**
 * Encrypt data using envelope encryption
 */
export function encryptData(
  data: string,
  keyMaterial: KeyMaterial
): EncryptedData {
  const iv = randomBytes(16); // 128-bit IV for GCM
  const cipher = createCipheriv(
    'aes-256-gcm',
    keyMaterial.dataEncryptionKey,
    iv
  );

  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyId: keyMaterial.keyId,
  };
}

/**
 * Decrypt data using envelope encryption
 */
export function decryptData(
  encryptedData: EncryptedData,
  keyMaterial: KeyMaterial
): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyMaterial.dataEncryptionKey,
    Buffer.from(encryptedData.iv, 'base64')
  );

  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'base64'));

  let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt a data encryption key with the key encryption key
 */
export function encryptDataEncryptionKey(dek: Buffer, kek: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);

  let encrypted = cipher.update(dek, undefined, 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  // Return as combined string: iv:tag:encrypted
  return [iv.toString('base64'), tag.toString('base64'), encrypted].join(':');
}

/**
 * Decrypt a data encryption key with the key encryption key
 */
export function decryptDataEncryptionKey(
  encryptedDek: string,
  kek: Buffer
): Buffer {
  const [ivB64, tagB64, encrypted] = encryptedDek.split(':');

  const decipher = createDecipheriv(
    'aes-256-gcm',
    kek,
    Buffer.from(ivB64, 'base64')
  );

  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);

  return decrypted;
}

/**
 * Create key material for encryption/decryption
 */
export function createKeyMaterial(
  masterKey: string,
  keyId: string
): KeyMaterial {
  const keyEncryptionKey = deriveKeyEncryptionKey(masterKey, keyId);
  const dataEncryptionKey = generateDataEncryptionKey();

  return {
    keyEncryptionKey,
    dataEncryptionKey,
    keyId,
  };
}

/**
 * Create key material from existing encrypted DEK
 */
export function loadKeyMaterial(
  masterKey: string,
  keyId: string,
  encryptedDek?: string
): KeyMaterial {
  const keyEncryptionKey = deriveKeyEncryptionKey(masterKey, keyId);

  let dataEncryptionKey: Buffer;
  if (encryptedDek) {
    dataEncryptionKey = decryptDataEncryptionKey(
      encryptedDek,
      keyEncryptionKey
    );
  } else {
    dataEncryptionKey = generateDataEncryptionKey();
  }

  return {
    keyEncryptionKey,
    dataEncryptionKey,
    keyId,
  };
}

/**
 * Validate master key format and strength
 */
export function validateMasterKey(masterKey: string): boolean {
  try {
    // Must be base64 encoded
    const decoded = Buffer.from(masterKey, 'base64');

    // Must be exactly 32 bytes (256 bits)
    return decoded.length === 32;
  } catch {
    return false;
  }
}

/**
 * Generate a secure HMAC for state signing
 */
export function createHmacSignature(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64');
}

/**
 * Verify HMAC signature
 */
export function verifyHmacSignature(
  data: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmacSignature(data, secret);
  return signature === expected;
}
