"use client";

import * as React from "react";
import { DollarSign } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CostAnalysisProps {
  payroll: number;
  charges: number;
  total: number;
  className?: string;
}

export function CostAnalysis({
  payroll,
  charges,
  total,
  className,
}: CostAnalysisProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coûts Mensuels
            </CardTitle>
            <CardDescription className="mt-1">
              Dernier mois
            </CardDescription>
          </div>
          <DollarSign className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-3xl font-bold lg:text-4xl">
            {new Intl.NumberFormat('fr-FR').format(total)} FCFA
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Masse salariale</span>
              <span className="font-medium">
                {new Intl.NumberFormat('fr-FR').format(payroll)} FCFA
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Charges patronales</span>
              <span className="font-medium">
                {new Intl.NumberFormat('fr-FR').format(charges)} FCFA
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
