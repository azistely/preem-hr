/**
 * Invitation Token Utilities
 *
 * Generates secure, URL-safe tokens for user invitations
 */

import crypto from 'crypto';

const TOKEN_BYTES = 32; // 256-bit entropy
const TOKEN_EXPIRY_DAYS = 7;

/**
 * Generate a secure, URL-safe invitation token
 * Returns the plaintext token and expiration date
 */
export function generateInviteToken(): {
  token: string;
  expiresAt: Date;
} {
  // Generate cryptographically secure random bytes
  const tokenBytes = crypto.randomBytes(TOKEN_BYTES);

  // URL-safe base64 encoding (43 characters)
  const token = tokenBytes.toString('base64url');

  // Calculate expiry (7 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  return { token, expiresAt };
}

/**
 * Generate the full invite URL for a token
 */
export function generateInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/invite/${encodeURIComponent(token)}`;
}

/**
 * Check if an invitation has expired
 */
export function isInviteExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Get time remaining until expiration in human-readable format (French)
 */
export function getTimeUntilExpiry(expiresAt: Date): string {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Expirée';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
  }

  if (hours > 0) {
    return `${hours} heure${hours > 1 ? 's' : ''} restante${hours > 1 ? 's' : ''}`;
  }

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes} minute${minutes > 1 ? 's' : ''} restante${minutes > 1 ? 's' : ''}`;
}
