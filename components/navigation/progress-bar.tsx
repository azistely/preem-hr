'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  trickleSpeed: 200,
  minimum: 0.08,
  easing: 'ease',
  speed: 200,
});

/**
 * Navigation Progress Bar
 *
 * Shows a top progress bar during page navigation to provide instant feedback.
 * Critical for UX - users should see feedback within 100ms of clicking a link.
 */
export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Complete progress when route changes
    NProgress.done();
  }, [pathname, searchParams]);

  return null;
}
