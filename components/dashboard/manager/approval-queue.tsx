"use client";

import * as React from "react";
import { CheckSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ApprovalItem {
  id: string;
  type: "leave" | "time" | "document";
  employeeName: string;
  description: string;
  date: Date;
}

export interface ApprovalQueueProps {
  items: ApprovalItem[];
  count: number;
  className?: string;
}

export function ApprovalQueue({
  items,
  count,
  className,
}: ApprovalQueueProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              À Approuver
            </CardTitle>
            <CardDescription className="mt-1">
              {count} demande{count > 1 ? 's' : ''} en attente
            </CardDescription>
          </div>
          <CheckSquare className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{item.employeeName}</p>
                  <Badge variant="secondary" className="text-xs">
                    {item.type === 'leave' ? 'Congé' : item.type === 'time' ? 'Temps' : 'Document'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  Rejeter
                </Button>
                <Button size="sm">
                  Approuver
                </Button>
              </div>
            </div>
          ))}

          {count > 3 && (
            <Button variant="ghost" className="w-full">
              Voir tout ({count})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
