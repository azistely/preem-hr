/**
 * PII Encryption/Decryption Utilities
 *
 * Uses AES-256-GCM for encrypting sensitive personal information
 * following GDPR and data protection requirements.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment
 * In production, this should be loaded from secure key management service
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }

  // Use a fixed salt for consistent key derivation
  // In production, this salt should also be stored securely
  const FIXED_SALT = 'preem-hr-encryption-salt-v1';
  const derivedKey = crypto.pbkdf2Sync(key, FIXED_SALT, 100000, KEY_LENGTH, 'sha512');

  return derivedKey;
}

/**
 * Encrypt sensitive data (PII)
 *
 * @param plaintext - Data to encrypt
 * @returns Base64-encoded encrypted data with IV and auth tag
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine IV + encrypted data + auth tag
    const combined = Buffer.concat([
      iv,
      Buffer.from(encrypted, 'hex'),
      tag
    ]);

    return combined.toString('base64');
  } catch (error) {
    console.error('[Crypto] Encryption error:', error);
    throw new Error('Échec du chiffrement des données');
  }
}

/**
 * Decrypt sensitive data (PII)
 *
 * @param ciphertext - Base64-encoded encrypted data
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract IV, encrypted data, and auth tag
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(combined.length - TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[Crypto] Decryption error:', error);
    throw new Error('Échec du déchiffrement des données');
  }
}

/**
 * Hash data for comparison (one-way)
 * Useful for checking duplicates without storing plaintext
 *
 * @param data - Data to hash
 * @returns SHA-256 hash (hex)
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
