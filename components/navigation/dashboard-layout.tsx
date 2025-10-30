"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MobileHeader } from "./mobile-header";
import { HamburgerMenu } from "./hamburger-menu";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleMenuClick = React.useCallback(() => {
    setIsMobileMenuOpen(true);
  }, []);

  const handleMenuClose = React.useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <div className={cn("min-h-screen", className)}>
      {/* Mobile Header */}
      <MobileHeader
        onMenuClick={handleMenuClick}
        notificationCount={0}
      />

      {/* Mobile Hamburger Menu */}
      <HamburgerMenu
        sections={navigation.mobile}
        isOpen={isMobileMenuOpen}
        onClose={handleMenuClose}
      />

      <div className="flex">
        {/* Desktop Sidebar */}
        <Sidebar
          sections={navigation.desktop}
          advancedSections={navigation.advanced}
          showSearch={userRole === "hr_manager" || userRole === "admin" || userRole === "tenant_admin" || userRole === "super_admin"}
          collapsible={true}
        />

        {/* Main Content */}
        <main className="flex-1 p-6 pb-16 lg:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
