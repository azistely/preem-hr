"use client";

import * as React from "react";
import { Users, UserCheck, UserX } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TeamOverviewProps {
  total: number;
  present: number;
  absent: number;
  className?: string;
}

export function TeamOverview({
  total,
  present,
  absent,
  className,
}: TeamOverviewProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mon Équipe
            </CardTitle>
            <CardDescription className="mt-1">
              Aujourd'hui
            </CardDescription>
          </div>
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-3xl font-bold lg:text-4xl">
            {total} personnes
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50">
              <UserCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-600">{present}</p>
                <p className="text-xs text-green-600">Présents</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50">
              <UserX className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold text-red-600">{absent}</p>
                <p className="text-xs text-red-600">Absents</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
