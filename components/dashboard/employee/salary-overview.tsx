"use client";

import * as React from "react";
import { DollarSign, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SalaryOverviewProps {
  netSalary: number;
  month: Date;
  showTrend?: boolean;
  showBreakdown?: boolean;
  className?: string;
}

export function SalaryOverview({
  netSalary,
  month,
  showTrend = false,
  showBreakdown = false,
  className,
}: SalaryOverviewProps) {
  const formattedMonth = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(month);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Salaire Net
            </CardTitle>
            <CardDescription className="mt-1 capitalize">
              {formattedMonth}
            </CardDescription>
          </div>
          <DollarSign className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-3xl font-bold lg:text-4xl">
            {new Intl.NumberFormat('fr-FR').format(netSalary)} FCFA
          </div>

          {showTrend && (
            <div className="flex items-center text-sm text-muted-foreground">
              <TrendingUp className="mr-1 h-4 w-4 text-green-600" />
              <span className="font-medium text-green-600">+5%</span>
              <span className="ml-1">vs mois précédent</span>
            </div>
          )}

          <Button variant="outline" className="w-full lg:w-auto">
            Voir le bulletin
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
