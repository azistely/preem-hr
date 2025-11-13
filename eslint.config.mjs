/**
 * ESLint Configuration (Flat Config Format)
 *
 * Enforces security rules for multi-tenant architecture:
 * - no-tenantid-in-input: Prevents tenant data leakage in tRPC endpoints
 */

import tsParser from '@typescript-eslint/parser';
import noTenantIdInInput from './eslint-local-rules/no-tenantid-in-input.js';

export default [
  {
    // Apply to TypeScript files in server/routers
    files: ['server/routers/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      'local-rules': {
        rules: {
          'no-tenantid-in-input': noTenantIdInInput,
        },
      },
    },
    rules: {
      // 🔒 CRITICAL SECURITY RULE: Prevent tenant data leakage
      'local-rules/no-tenantid-in-input': 'error',
    },
  },
  {
    // Global ignores
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.vercel/**',
      // Ignore tenant.ts - it legitimately needs tenantId for admin operations
      'server/routers/tenant.ts',
    ],
  },
];
