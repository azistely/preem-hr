import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Add search_path to connection string to avoid conflicts with auth.users table
const connectionString = process.env.DATABASE_URL + '?options=-c%20search_path%3Dpublic';
console.log('[DB] Initializing connection with search_path=public...');
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

// Create postgres-js client with custom type configuration
const client = postgres(connectionString, {
  ...dateTypeConfig,
  onnotice: () => {}, // Suppress notices
});

console.log('[DB] Date parsers configured for Drizzle compatibility');

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
    // Add search_path parameter to avoid auth.users conflicts
    let serviceConnectionString = process.env.SERVICE_ROLE_DATABASE_URL || connectionString;

    // Ensure search_path is set (connectionString already has it)
    if (!serviceConnectionString.includes('search_path')) {
      serviceConnectionString += '?options=-c%20search_path%3Dpublic';
    }

    if (!process.env.SERVICE_ROLE_DATABASE_URL) {
      console.warn('[DB] SERVICE_ROLE_DATABASE_URL not set, using standard connection (RLS will apply)');
    }

    serviceRoleClient = postgres(serviceConnectionString, {
      ...dateTypeConfig,
      onnotice: () => {},
    });
    serviceRoleDb = drizzle({ client: serviceRoleClient, schema });
    console.log('[DB] Service role client initialized');
  }

  return serviceRoleDb as typeof db;
}
