/**
 * Preem Logo Component
 *
 * Reusable logo component with different sizes
 * Uses Next.js Image for optimal loading
 */

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PreemLogoProps {
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
}

const SIZES = {
  sm: { width: 80, height: 40 },
  default: { width: 120, height: 60 },
  lg: { width: 160, height: 80 },
  xl: { width: 200, height: 100 },
} as const;

export function PreemLogo({ className, size = 'default' }: PreemLogoProps) {
  const dimensions = SIZES[size];

  return (
    <Image
      src="/preem-logo.png"
      alt="Preem"
      width={dimensions.width}
      height={dimensions.height}
      className={cn('object-contain', className)}
      priority
    />
  );
}

/**
 * Preem Logo Text Only
 * For use in headers where we want just the wordmark
 */
export function PreemLogoText({ className }: { className?: string }) {
  return (
    <span className={cn('text-2xl font-bold text-preem-teal', className)}>
      preem
    </span>
  );
}
