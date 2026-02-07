/**
 * Jamana Logo Component
 *
 * Reusable logo component with different sizes
 * Uses Next.js Image for optimal loading
 */

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface JamanaLogoProps {
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
}

const SIZES = {
  sm: { width: 80, height: 40 },
  default: { width: 120, height: 60 },
  lg: { width: 160, height: 80 },
  xl: { width: 200, height: 100 },
} as const;

export function JamanaLogo({ className, size = 'default' }: JamanaLogoProps) {
  const dimensions = SIZES[size];

  return (
    <Image
      src="/jamana-logo.png"
      alt="Jamana"
      width={dimensions.width}
      height={dimensions.height}
      className={cn('object-contain', className)}
      priority
    />
  );
}

/**
 * Jamana Logo Text Only
 * For use in headers where we want just the wordmark
 */
export function JamanaLogoText({ className }: { className?: string }) {
  return (
    <span className={cn('text-2xl font-bold text-preem-teal', className)}>
      jamana
    </span>
  );
}
