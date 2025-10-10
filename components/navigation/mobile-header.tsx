"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MobileHeaderProps {
  onMenuClick: () => void;
  notificationCount?: number;
  className?: string;
}

export function MobileHeader({
  onMenuClick,
  notificationCount = 0,
  className,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-[99] flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden shadow-sm",
        className
      )}
    >
      {/* Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="min-h-[44px] min-w-[44px]"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Logo */}
      <Link href="/" className="text-lg font-semibold">
        Preem HR
      </Link>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-[44px] min-w-[44px]"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-5 px-1.5 text-xs"
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </Badge>
          )}
        </Button>

        {/* Profile */}
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          aria-label="Profil"
        >
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
