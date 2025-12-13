/**
 * Performance Layout
 *
 * Wraps all /performance/* pages with the CycleProgressSidebar.
 * The sidebar provides a unified view of cycle progress and readiness checks.
 */

'use client';

import { CycleProgressSidebar } from '@/components/performance/cycle-progress-sidebar';

export default function PerformanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto">{children}</div>
      <CycleProgressSidebar />
    </div>
  );
}
