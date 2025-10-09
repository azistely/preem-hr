"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { getNavigationByRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole: string;
  className?: string;
}

export function DashboardLayout({
  children,
  userRole,
  className,
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const navigation = getNavigationByRole(userRole);

  return (
    <div className={cn("min-h-screen", className)}>
      <div className="flex">
        {/* Desktop Sidebar */}
        <Sidebar
          sections={navigation.desktop}
          showSearch={userRole === "hr_manager" || userRole === "admin"}
          collapsible={true}
        />

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav items={navigation.mobile} />
    </div>
  );
}
