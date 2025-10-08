'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HelpBoxProps {
  children: ReactNode;
  className?: string;
}

export function HelpBox({ children, className }: HelpBoxProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm',
        className
      )}
    >
      {children}
    </div>
  );
}
