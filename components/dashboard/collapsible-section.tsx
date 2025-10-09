"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CollapsibleSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleSection({
  title,
  count,
  children,
  defaultOpen = false,
  className,
}: CollapsibleSectionProps) {
  // Desktop: expanded by default, Mobile: collapsed by default
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  // Auto-expand on desktop
  React.useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      if (isDesktop) {
        setIsOpen(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 lg:p-6">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold md:text-lg">{title}</h3>
            {count !== undefined && (
              <span className="text-sm text-muted-foreground">({count})</span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t">
          <div className="p-4 lg:p-6">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
