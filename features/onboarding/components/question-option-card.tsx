'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QuestionOptionCardProps {
  icon: string;
  label: string;
  description: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function QuestionOptionCard({
  icon,
  label,
  description,
  onClick,
  className,
  disabled = false,
}: QuestionOptionCardProps) {
  return (
    <Card
      className={cn(
        'p-4 transition-all cursor-pointer',
        'hover:shadow-md hover:border-primary',
        'active:scale-[0.98]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={disabled ? undefined : onClick}
    >
      <div className="flex items-center gap-4">
        <div className="text-4xl flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg mb-1">
            {label}
          </p>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}
