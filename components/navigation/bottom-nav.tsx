"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  badge?: string | number;
}

export interface BottomNavProps {
  items: NavItem[];
  className?: string;
}

export function BottomNav({ items, className }: BottomNavProps) {
  const pathname = usePathname();

  // Only show on mobile
  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden",
        className
      )}
    >
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center gap-1 px-2 py-2 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {item.badge && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-2 -top-2 h-4 min-w-4 px-1 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
