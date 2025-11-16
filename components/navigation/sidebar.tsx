"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LucideIcon, ChevronLeft, ChevronDown, Search, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { TenantSwitcher } from "@/components/layout/tenant-switcher";
import NProgress from "nprogress";

export interface NavSection {
  title: string;
  items: NavItem[];
  children?: NavSection[]; // Support nested sections (for organized admin)
  defaultOpen?: boolean; // Whether section should be open by default
}

export interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  badge?: string | number;
  variant?: 'default' | 'warning' | 'destructive';
}

export interface SidebarProps {
  sections: NavSection[];
  advancedSections?: NavSection[];
  showSearch?: boolean;
  showUserProfile?: boolean;
  collapsible?: boolean;
  className?: string;
}

// Component to render collapsible nav sections with modern styling
function CollapsibleNavSection({
  section,
  pathname,
  isCollapsed,
  defaultOpen = false,
}: {
  section: NavSection;
  pathname: string | null;
  isCollapsed: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  // If no title, render items without collapsible wrapper (e.g., Dashboard)
  if (!section.title || isCollapsed) {
    return (
      <nav className="space-y-1">
        {section.items.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => NProgress.start()}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 min-h-[44px]",
                "active:scale-[0.98] active:opacity-90",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
                      className="h-5 min-w-5 px-1.5 text-xs font-semibold"
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
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-1">
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-200 min-h-[40px]",
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
        <nav className="space-y-1">
          {section.items.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => NProgress.start()}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 min-h-[44px]",
                  "active:scale-[0.98] active:opacity-90",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
              </Link>
            );
          })}
        </nav>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Component to render nested sections (e.g., Administration with subsections)
function NestedSection({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string;
}) {
  const [isOpen, setIsOpen] = React.useState(section.defaultOpen ?? false);

  return (
    <div className="space-y-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-200",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              isOpen && "text-foreground"
            )}
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
            <span className="flex-1 text-left">{section.title}</span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 pt-2 pl-3">
          {section.children?.map((childSection, index) => (
            <div key={index} className="space-y-2">
              {childSection.title && (
                <h4 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {childSection.title}
                </h4>
              )}
              <nav className="space-y-1">
                {childSection.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    pathname?.startsWith(item.href + "/");
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => NProgress.start()}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 min-h-[44px]",
                        "active:scale-[0.98] active:opacity-90",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <Badge
                          variant={
                            item.variant === 'warning'
                              ? "default"
                              : (item.variant === 'destructive' ? "destructive" : "default")
                          }
                          className="h-5 min-w-5 px-1.5 text-xs font-semibold"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
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
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = React.useState(true); // Start collapsed
  const [isHovered, setIsHovered] = React.useState(false); // Track hover state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const supabase = createAuthClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

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

  // Determine if sidebar should show as collapsed (considering both collapsed state and hover)
  const showCollapsed = isCollapsed && !isHovered;

  // Only show on desktop
  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "hidden lg:flex lg:flex-col border-r bg-background transition-all duration-300",
        showCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header with Tenant Switcher */}
      <div className="border-b">
        <div className="flex h-14 items-center justify-between px-4">
          {!showCollapsed && (
            <h2 className="text-lg font-semibold">Preem HR</h2>
          )}
          {collapsible && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn("h-8 w-8", showCollapsed && "mx-auto")}
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 transition-transform",
                  showCollapsed && "rotate-180"
                )}
              />
            </Button>
          )}
        </div>
        {/* Tenant Switcher */}
        {!showCollapsed && (
          <div className="px-4 pb-3">
            <TenantSwitcher variant="full" className="w-full justify-start" />
          </div>
        )}
      </div>

      {/* Search */}
      {showSearch && !showCollapsed && (
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
        <div className="space-y-2 p-4">
          {filteredSections.map((section, index) => {
            // Check if any item in section is active to auto-expand
            const hasActiveItem = section.items.some(
              (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
            );

            return (
              <CollapsibleNavSection
                key={index}
                section={section}
                pathname={pathname}
                isCollapsed={showCollapsed}
                defaultOpen={section.defaultOpen ?? hasActiveItem}
              />
            );
          })}

          {/* Advanced Features (Collapsible) */}
          {advancedSections.length > 0 && !showCollapsed && (
            <div className="space-y-2 border-t border-border pt-3 mt-3">
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 min-h-[44px]",
                      "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      showAdvanced && "bg-accent text-accent-foreground"
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        showAdvanced && "rotate-180"
                      )}
                    />
                    <span className="flex-1 text-left">Plus d'options</span>
                    {advancedSections.length > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {advancedSections.reduce((acc, section) => acc + section.items.length, 0)}
                      </span>
                    )}
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-2 pt-2">
                  {advancedSections.map((section, sectionIndex) => {
                    // Check if this section has nested children (like Administration)
                    if (section.children && section.children.length > 0) {
                      return (
                        <NestedSection
                          key={sectionIndex}
                          section={section}
                          pathname={pathname}
                        />
                      );
                    }

                    // Regular section rendering with collapsible
                    const hasActiveItem = section.items.some(
                      (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
                    );

                    return (
                      <CollapsibleNavSection
                        key={sectionIndex}
                        section={section}
                        pathname={pathname}
                        isCollapsed={false}
                        defaultOpen={section.defaultOpen ?? hasActiveItem}
                      />
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Logout Button */}
      <div className="border-t p-4">
        <Button
          onClick={handleLogout}
          disabled={isLoggingOut}
          variant="ghost"
          className="w-full justify-start gap-3 min-h-[44px] text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!showCollapsed && (
            <span>{isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}</span>
          )}
        </Button>
      </div>
    </aside>
  );
}
