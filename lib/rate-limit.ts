/**
 * Rate Limiting with Upstash Redis
 *
 * Protects authentication endpoints from brute force attacks
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env)
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * Rate limiter for login attempts
 * 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      analytics: true,
      prefix: 'ratelimit:login',
    })
  : null;

/**
 * Rate limiter for signup attempts
 * 3 attempts per hour per IP
 */
export const signupRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      analytics: true,
      prefix: 'ratelimit:signup',
    })
  : null;

/**
 * Rate limiter for password reset requests
 * 3 attempts per hour per email
 */
export const passwordResetRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'),
      analytics: true,
      prefix: 'ratelimit:password-reset',
    })
  : null;

/**
 * Rate limiter for invitation creation
 * 10 invitations per hour per tenant
 */
export const inviteCreateRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: 'ratelimit:invite:create',
    })
  : null;

/**
 * Rate limiter for invitation acceptance attempts
 * 5 attempts per 15 minutes per IP (prevent brute force)
 */
export const inviteAcceptRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      analytics: true,
      prefix: 'ratelimit:invite:accept',
    })
  : null;

/**
 * Rate limiter for invitation email resends
 * 3 resends per invitation per day
 */
export const inviteResendRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '24 h'),
      analytics: true,
      prefix: 'ratelimit:invite:resend',
    })
  : null;

/**
 * Get client IP from headers (works with Vercel, Cloudflare, etc.)
 */
export function getClientIp(headers: Headers): string {
  // Try various headers in order
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback
  return 'unknown';
}
