/**
 * Policies Layout
 *
 * Shared layout for all policy configuration pages
 * Provides tab navigation between different policy types
 */

'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container max-w-7xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Configuration des politiques</h1>
          <p className="text-muted-foreground mt-2">
            Gestion conforme à la Convention Collective
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <PoliciesTabs />

      {/* Content */}
      <div className="mt-8">{children}</div>
    </div>
  );
}

function PoliciesTabs() {
  const pathname = usePathname();

  const getActiveTab = () => {
    if (pathname?.includes('/time-off')) return 'time-off';
    if (pathname?.includes('/overtime')) return 'overtime';
    if (pathname?.includes('/accrual')) return 'accrual';
    return 'time-off';
  };

  return (
    <Tabs value={getActiveTab()} className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="time-off" asChild>
          <Link href="/admin/policies/time-off">Congés</Link>
        </TabsTrigger>
        <TabsTrigger value="overtime" asChild>
          <Link href="/admin/policies/overtime">Heures sup.</Link>
        </TabsTrigger>
        <TabsTrigger value="accrual" asChild>
          <Link href="/admin/policies/accrual">Acquisition</Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
