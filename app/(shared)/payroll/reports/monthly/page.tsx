'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Monthly Reports Redirect Page
 *
 * Redirects to the current month's reports page
 */
export default function MonthlyReportsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Get current month in YYYY-MM format
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonth = `${year}-${month}`;

    // Redirect to current month
    router.push(`/payroll/reports/monthly/${currentMonth}`);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Chargement des rapports mensuels...</p>
      </div>
    </div>
  );
}
