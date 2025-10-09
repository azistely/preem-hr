"use client";

import * as React from "react";
import { Building2, Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface OrganizationHeaderProps {
  name: string;
  plan: string;
  expiryDate: Date;
  className?: string;
}

export function OrganizationHeader({
  name,
  plan,
  expiryDate,
  className,
}: OrganizationHeaderProps) {
  const formattedExpiry = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(expiryDate);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl">{name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{plan}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Expire le {formattedExpiry}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
