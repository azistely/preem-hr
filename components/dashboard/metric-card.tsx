"use client";

import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: string;
    label: string;
    direction: "up" | "down" | "neutral";
  };
  icon?: LucideIcon;
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  title,
  value,
  trend,
  icon: Icon,
  loading = false,
  className,
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={cn("p-3 md:p-4 lg:p-6", className)}>
        <div className="space-y-2 md:space-y-3 lg:space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32 md:h-10 lg:h-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-3 md:p-4 lg:p-6", className)}>
      <CardHeader className="p-0 pb-2 md:pb-3 lg:pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {Icon && (
            <Icon className="h-4 w-4 text-muted-foreground md:h-5 md:w-5" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="text-2xl font-bold md:text-3xl lg:text-4xl">
          {value}
        </div>
        {trend && (
          <div className="mt-1 flex items-center text-xs text-muted-foreground md:text-sm">
            <span
              className={cn("font-medium", {
                "text-green-600": trend.direction === "up",
                "text-red-600": trend.direction === "down",
                "text-gray-600": trend.direction === "neutral",
              })}
            >
              {trend.value}
            </span>
            <span className="ml-1">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
