"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface LeaveBalanceProps {
  used: number;
  total: number;
  remaining: number;
  className?: string;
}

export function LeaveBalance({
  used,
  total,
  remaining,
  className,
}: LeaveBalanceProps) {
  const percentage = (used / total) * 100;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solde de Congés
            </CardTitle>
            <CardDescription className="mt-1">
              Année en cours
            </CardDescription>
          </div>
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-3xl font-bold lg:text-4xl">
            {remaining} jours
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Utilisés: {used} jours</span>
              <span>Total: {total} jours</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
