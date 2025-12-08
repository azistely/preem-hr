/**
 * Next.js Instrumentation File
 *
 * Initializes Sentry for backend error tracking and tracing.
 * This file runs once when the Next.js server starts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/node');

    Sentry.init({
      dsn: 'https://Hq2mG3H8rr1A3ZjT3Sak@sonarly.dev/148',
      tracesSampleRate: 1.0,
      environment: process.env.NODE_ENV || 'development',
      // Enable profiling for performance insights
      profilesSampleRate: 1.0,
    });
  }
}
