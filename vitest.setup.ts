/**
 * Vitest Setup File
 *
 * Mocks and global setup for all tests
 */

import { vi } from 'vitest';

// Mock 'server-only' module to allow server components in tests
vi.mock('server-only', () => ({}));
