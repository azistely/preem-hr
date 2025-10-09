"use client";

import * as React from "react";
import { AlertCircle, Calendar, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CriticalActionsProps {
  payrollDue: boolean;
  pendingLeave: number;
  className?: string;
}

export function CriticalActions({
  payrollDue,
  pendingLeave,
  className,
}: CriticalActionsProps) {
  const totalActions = (payrollDue ? 1 : 0) + (pendingLeave > 0 ? 1 : 0);

  return (
    <Card className={cn("border-destructive", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg">Actions Critiques</CardTitle>
          </div>
          <Badge variant="destructive">{totalActions}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {payrollDue && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-orange-200 bg-orange-50">
            <Calendar className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-orange-900">Paie à lancer</p>
              <p className="text-sm text-orange-700">
                À lancer avant le 25
              </p>
            </div>
            <Button size="sm" variant="default">
              Commencer
            </Button>
          </div>
        )}

        {pendingLeave > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50">
            <Users className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-blue-900">
                {pendingLeave} demande{pendingLeave > 1 ? 's' : ''} de congé
              </p>
              <p className="text-sm text-blue-700">
                En attente de validation
              </p>
            </div>
            <Button size="sm" variant="outline">
              Voir
            </Button>
          </div>
        )}

        {totalActions === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucune action critique
          </div>
        )}
      </CardContent>
    </Card>
  );
}
