'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { useLinkStatus } from 'next/link';
import NProgress from 'nprogress';
import { cn } from '@/lib/utils';

/**
 * PrefetchLink - Optimized Link Component with Hover Prefetching
 *
 * Best practices from Next.js App Router documentation:
 * 1. Uses prefetch={false} by default to avoid aggressive prefetching
 * 2. Enables prefetch on hover (prefetch={null}) for routes user is likely to visit
 * 3. Starts NProgress immediately for instant visual feedback
 *
 * @see https://nextjs.org/docs/app/guides/prefetching
 */
export function PrefetchLink({
  href,
  children,
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Link>) {
  const [shouldPrefetch, setShouldPrefetch] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setShouldPrefetch(true);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    NProgress.start();
    onClick?.(e);
  }, [onClick]);

  return (
    <Link
      href={href}
      prefetch={shouldPrefetch ? null : false}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {children}
    </Link>
  );
}

/**
 * LinkWithLoadingIndicator - Link with inline loading state
 *
 * Uses the useLinkStatus hook from Next.js to show loading feedback
 * while navigation is pending. Perfect for slow networks.
 *
 * @see https://nextjs.org/docs/app/getting-started/linking-and-navigating
 */
export function LinkLoadingIndicator({ className }: { className?: string }) {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      role="status"
      aria-label="Chargement"
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}

/**
 * NavLink - Navigation link with prefetch and active state styling
 *
 * Combines PrefetchLink with active state detection for sidebar/navbar items.
 */
export interface NavLinkProps extends React.ComponentProps<typeof Link> {
  isActive?: boolean;
  activeClassName?: string;
  inactiveClassName?: string;
}

export function NavLink({
  href,
  children,
  className,
  isActive,
  activeClassName = "bg-primary text-primary-foreground shadow-sm",
  inactiveClassName = "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  ...props
}: NavLinkProps) {
  const [shouldPrefetch, setShouldPrefetch] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setShouldPrefetch(true);
  }, []);

  const handleClick = useCallback(() => {
    NProgress.start();
  }, []);

  return (
    <Link
      href={href}
      prefetch={shouldPrefetch ? null : false}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      className={cn(
        className,
        isActive ? activeClassName : inactiveClassName
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
