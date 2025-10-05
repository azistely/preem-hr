import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env file
config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // Browser mode configuration (Vitest 3.x)
    browser: {
      enabled: false, // Enable with --browser flag
      name: 'chromium',
      provider: 'playwright',
      headless: true,
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['features/**/*.ts', 'components/**/*.{ts,tsx}'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types.ts', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
