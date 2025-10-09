"use client";

import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface QuickActionCardProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  onClick?: () => void;
  badge?: string | number;
  disabled?: boolean;
  className?: string;
}

export function QuickActionCard({
  icon: Icon,
  label,
  description,
  onClick,
  badge,
  disabled = false,
  className,
}: QuickActionCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md active:scale-98",
        "min-h-[44px] w-full lg:w-auto",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className="flex items-center gap-3 p-3 md:p-4 lg:gap-4 lg:p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 md:h-12 md:w-12">
          <Icon className="h-5 w-5 text-primary md:h-6 md:w-6" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium md:text-base lg:text-lg">
              {label}
            </p>
            {badge && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                {badge}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground md:text-sm">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
