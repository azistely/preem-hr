"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface DataItem {
  [key: string]: any;
}

export interface ResponsiveDataDisplayProps<T extends DataItem> {
  data: T[];
  mobileView: (item: T, index: number) => React.ReactNode;
  desktopView?: (data: T[]) => React.ReactNode;
  loading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
}

export function ResponsiveDataDisplay<T extends DataItem>({
  data,
  mobileView,
  desktopView,
  loading = false,
  emptyState,
  className,
}: ResponsiveDataDisplayProps<T>) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-16 w-full animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={className}>
      {/* Mobile: Card list view */}
      <div className="block space-y-3 lg:hidden">
        {data.map((item, index) => (
          <Card key={index}>
            <CardContent className="p-3">{mobileView(item, index)}</CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Data table view or custom view */}
      <div className="hidden lg:block">
        {desktopView ? desktopView(data) : (
          <div className="space-y-3">
            {data.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  {mobileView(item, index)}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
