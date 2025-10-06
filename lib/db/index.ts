import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/drizzle/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const connectionString = process.env.DATABASE_URL;
console.log('[DB] Initializing connection...');

// ✅ FIX: Override postgres.js default date parsers
// This resolves the "Received an instance of Date" error
// See: https://github.com/porsager/postgres/discussions/761
// Required for Drizzle ORM v0.30.0+ compatibility

// Create postgres-js client with custom type configuration
const client = postgres(connectionString, {
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
});

console.log('[DB] Date parsers configured for Drizzle compatibility');

export const db = drizzle({ client, schema });
