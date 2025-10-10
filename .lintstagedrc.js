/**
 * Lint-Staged Configuration
 *
 * Run type checking and linting on staged files before commit
 */

module.exports = {
  // TypeScript files - run type check only
  '**/*.{ts,tsx}': () => [
    'npm run type-check',  // Check entire project for type errors
    // Temporarily disabled: Next.js lint is deprecated and requires interactive input
    // 'npm run lint:fix',
  ],

  // All files - format with prettier (if added later)
  // '**/*.{js,jsx,ts,tsx,json,css,md}': 'prettier --write',
};
