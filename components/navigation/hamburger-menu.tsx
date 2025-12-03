"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { NavSection } from "./sidebar";
import { PrefetchLink } from "./prefetch-link";

export interface HamburgerMenuProps {
  sections: NavSection[];
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function HamburgerMenu({
  sections,
  isOpen,
  onClose,
  className,
}: HamburgerMenuProps) {
  const pathname = usePathname();

  // Close menu when route changes
  React.useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Prevent body scroll when menu is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-in Menu */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[101] w-[280px] transform border-r bg-background transition-transform duration-300 lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <h2 className="text-lg font-semibold">Menu</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <nav className="space-y-2 p-4">
            {sections.map((section, index) => (
              <NavSectionComponent
                key={index}
                section={section}
                pathname={pathname}
              />
            ))}
          </nav>
        </ScrollArea>
      </aside>
    </>
  );
}

function NavSectionComponent({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string | null;
}) {
  // Check if any item in section is active (auto-expand active sections)
  const hasActiveItem = section.items.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
  );

  const [isOpen, setIsOpen] = React.useState(section.defaultOpen ?? hasActiveItem);

  // If no title, render items without collapsible wrapper (e.g., Dashboard)
  if (!section.title) {
    return (
      <div className="space-y-1">
        {section.items.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <PrefetchLink
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 min-h-[48px]",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <Badge
                  variant={isActive ? "secondary" : "default"}
                  className="h-5 min-w-5 px-1.5 text-xs font-semibold"
                >
                  {item.badge}
                </Badge>
              )}
            </PrefetchLink>
          );
        })}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-1">
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-all duration-200 min-h-[44px]",
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            isOpen && "text-foreground"
          )}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
          <span className="flex-1 text-left">{section.title}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {section.items.length}
          </span>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-1 pl-2 pt-1">
        <div className="space-y-1">
          {section.items.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <PrefetchLink
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 min-h-[48px]",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <Badge
                    variant={isActive ? "secondary" : "default"}
                    className="h-5 min-w-5 px-1.5 text-xs font-semibold"
                  >
                    {item.badge}
                  </Badge>
                )}
              </PrefetchLink>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Collapsible Section Component (for advanced features)
export function CollapsibleNavSection({
  title,
  section,
  pathname,
  defaultOpen = false,
}: {
  title: string;
  section: NavSection;
  pathname: string | null;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted min-h-[48px]">
        <span className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )}
          />
          {title}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4">
        <NavSectionComponent section={section} pathname={pathname} />
      </CollapsibleContent>
    </Collapsible>
  );
}
