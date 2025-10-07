/**
 * Admin Layout
 *
 * Provides navigation shell for admin features:
 * - Time tracking approval
 * - Time-off approval
 * - Employee management
 */

'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Calendar, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: ReactNode;
}

const adminNavItems = [
  {
    href: '/admin/time-tracking',
    label: 'Heures de travail',
    icon: Clock,
    description: 'Approuver les heures',
  },
  {
    href: '/admin/time-off',
    label: 'Demandes de congé',
    icon: Calendar,
    description: 'Approuver les congés',
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <span className="text-lg font-bold">P</span>
              </div>
              <span className="hidden font-semibold sm:inline-block">
                PREEM HR - Administration
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="ml-auto flex items-center gap-2">
            {adminNavItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">{children}</main>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Clock;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'min-h-[44px]', // Touch target
        isActive && 'bg-accent text-accent-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
