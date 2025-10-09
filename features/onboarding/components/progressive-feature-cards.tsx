'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: string;
  title: string;
  subtitle?: string;
  href: string;
}

export function FeatureCard({ icon, title, subtitle, href }: FeatureCardProps) {
  return (
    <Link href={href}>
      <Card className={cn(
        'p-4 cursor-pointer transition-all',
        'hover:shadow-md hover:border-primary',
        'active:scale-[0.98]',
        'min-h-[100px]'
      )}>
        <div className="text-center">
          <div className="text-3xl mb-2">{icon}</div>
          <div className="font-semibold text-sm">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground mt-1">
              {subtitle}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

interface ChecklistItemProps {
  icon: string;
  text: string;
}

export function ChecklistItem({ icon, text }: ChecklistItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
      <span className="text-xl">{icon}</span>
      <span className="text-sm">{text}</span>
    </div>
  );
}
