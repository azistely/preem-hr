"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon, ChevronLeft, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  badge?: string | number;
}

export interface SidebarProps {
  sections: NavSection[];
  advancedSections?: NavSection[];
  showSearch?: boolean;
  showUserProfile?: boolean;
  collapsible?: boolean;
  className?: string;
}

export function Sidebar({
  sections,
  advancedSections = [],
  showSearch = false,
  showUserProfile = false,
  collapsible = true,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Filter items based on search
  const filteredSections = React.useMemo(() => {
    if (!searchQuery) return sections;

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, searchQuery]);

  // Only show on desktop
  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col border-r bg-background transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold">Preem HR</h2>
        )}
        {collapsible && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn("h-8 w-8", isCollapsed && "mx-auto")}
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform",
                isCollapsed && "rotate-180"
              )}
            />
          </Button>
        )}
      </div>

      {/* Search */}
      {showSearch && !isCollapsed && (
        <div className="border-b p-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {filteredSections.map((section, index) => (
            <div key={index} className="space-y-2">
              {!isCollapsed && section.title && (
                <h3 className="px-2 text-xs font-semibold uppercase text-muted-foreground">
                  {section.title}
                </h3>
              )}
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname?.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <Badge
                              variant={isActive ? "secondary" : "default"}
                              className="h-5 min-w-5 px-1.5"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}

          {/* Advanced Features (Collapsible) */}
          {advancedSections.length > 0 && !isCollapsed && (
            <div className="space-y-2 border-t-2 border-border pt-4 mt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px]"
              >
                <ChevronLeft
                  className={cn(
                    "h-4 w-4 transition-transform",
                    showAdvanced && "-rotate-90"
                  )}
                />
                <span className="flex-1 text-left">Plus d'options</span>
                {advancedSections.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {advancedSections.reduce((acc, section) => acc + section.items.length, 0)}
                  </span>
                )}
              </button>

              {showAdvanced && (
                <div className="space-y-4">
                  {advancedSections.map((section, index) => (
                    <div key={index} className="space-y-2">
                      {section.title && (
                        <h3 className="px-2 text-xs font-semibold uppercase text-muted-foreground">
                          {section.title}
                        </h3>
                      )}
                      <nav className="space-y-1">
                        {section.items.map((item) => {
                          const isActive =
                            pathname === item.href ||
                            pathname?.startsWith(item.href + "/");
                          const Icon = item.icon;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={cn(
                                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors min-h-[44px]",
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="flex-1">{item.label}</span>
                            </Link>
                          );
                        })}
                      </nav>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
