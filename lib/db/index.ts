import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// ✅ FIX: Add Vercel workaround suffix for Transaction pooler (required for serverless)
// See: https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers
let connectionString = process.env.DATABASE_URL;
if (!connectionString.includes('workaround=supabase-pooler.vercel')) {
  connectionString += connectionString.includes('?')
    ? '&workaround=supabase-pooler.vercel'
    : '?workaround=supabase-pooler.vercel';
}

console.log('[DB] Initializing Supabase connection...');
console.log('[DB] Connection string:', connectionString.replace(/:[^:@]+@/, ':****@')); // Mask password

// ✅ FIX: Override postgres.js default date parsers
// This resolves the "Received an instance of Date" error
// See: https://github.com/porsager/postgres/discussions/761
// Required for Drizzle ORM v0.30.0+ compatibility

// Date type configuration for postgres-js
const dateTypeConfig = {
  types: {
    // Timestamp with timezone - OID 1184
    timestamptz: {
      to: 1184,
      from: [1184],
      serialize: (x: any) => x instanceof Date ? x.toISOString() : x,
      parse: (x: string) => x
    },
    // Timestamp without timezone - OID 1114
    timestamp: {
      to: 1114,
      from: [1114],
      serialize: (x: any) => x instanceof Date ? x.toISOString() : x,
      parse: (x: string) => x
    },
    // Date - OID 1082
    date: {
      to: 1082,
      from: [1082],
      serialize: (x: any) => x instanceof Date ? x.toISOString().split('T')[0] : x,
      parse: (x: string) => x
    },
  }
};

// ✅ SERVERLESS FIX: Configuration optimized for Vercel serverless functions
// Key settings:
// - prepare: false (required for Transaction pooler mode on port 6543)
// - max: 1 for production, 10 for development (to handle concurrent requests)
// - idle_timeout: 20 (close idle connections after 20 seconds)
// - connect_timeout: 10 (fail fast if connection takes too long)
const postgresConfig = {
  ...dateTypeConfig,
  prepare: false, // Required for Transaction mode pooler
  max: process.env.NODE_ENV === 'production' ? 1 : 10, // Multiple connections for dev, single for serverless
  idle_timeout: 20, // Close idle connections after 20s
  connect_timeout: 10, // Timeout after 10s
  onnotice: () => {}, // Suppress notices
};

// Create postgres-js client with serverless-optimized configuration
const client = postgres(connectionString, postgresConfig);

console.log('[DB] Date parsers configured for Drizzle compatibility');
console.log('[DB] Serverless mode: max=1, idle_timeout=20s');

/**
 * Standard database client
 * Subject to RLS policies based on JWT auth
 */
export const db = drizzle({ client, schema });

/**
 * Service role database client
 * Bypasses RLS policies - USE WITH CAUTION
 *
 * Only use for:
 * - User signup (before auth exists)
 * - Admin operations that need to bypass tenant isolation
 * - System maintenance tasks
 *
 * NEVER expose this to client-side code or untrusted endpoints
 */
let serviceRoleClient: any = null;
let serviceRoleDb: any = null;

export function getServiceRoleDb() {
  if (!serviceRoleDb) {
    // Use service role connection string or fall back to standard with a warning
    let serviceConnectionString = process.env.SERVICE_ROLE_DATABASE_URL || connectionString;

    if (!process.env.SERVICE_ROLE_DATABASE_URL) {
      console.warn('[DB] SERVICE_ROLE_DATABASE_URL not set, using standard connection (RLS will apply)');
    }

    // Add Vercel workaround suffix if not present (same as main connection)
    if (!serviceConnectionString.includes('workaround=supabase-pooler.vercel')) {
      serviceConnectionString += serviceConnectionString.includes('?')
        ? '&workaround=supabase-pooler.vercel'
        : '?workaround=supabase-pooler.vercel';
    }

    serviceRoleClient = postgres(serviceConnectionString, postgresConfig);
    serviceRoleDb = drizzle({ client: serviceRoleClient, schema });
    console.log('[DB] Service role client initialized');
  }

  return serviceRoleDb as typeof db;
}
