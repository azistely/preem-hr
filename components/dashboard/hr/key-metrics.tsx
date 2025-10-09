"use client";

import * as React from "react";
import { Users, DollarSign, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { cn } from "@/lib/utils";

export interface KeyMetricsProps {
  employeeCount: number;
  payrollCost: number;
  turnover?: number;
  className?: string;
}

export function KeyMetrics({
  employeeCount,
  payrollCost,
  turnover = 0,
  className,
}: KeyMetricsProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      <MetricCard
        title="Effectif"
        value={employeeCount}
        icon={Users}
        trend={{
          value: "+2",
          label: "ce mois",
          direction: "up",
        }}
      />

      <MetricCard
        title="Masse Salariale"
        value={`${(payrollCost / 1000000).toFixed(1)}M FCFA`}
        icon={DollarSign}
        trend={{
          value: "+5%",
          label: "vs mois dernier",
          direction: "up",
        }}
      />

      <MetricCard
        title="Turnover"
        value={`${turnover.toFixed(1)}%`}
        icon={TrendingUp}
        trend={{
          value: "-2%",
          label: "amélioration",
          direction: "down",
        }}
      />
    </div>
  );
}
