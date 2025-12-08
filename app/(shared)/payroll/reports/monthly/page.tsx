import { redirect } from 'next/navigation';

/**
 * Monthly Reports Redirect Page
 *
 * Redirects to the current month's reports page
 */
export default function MonthlyReportsRedirect() {
  // Get current month in YYYY-MM format
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonth = `${year}-${month}`;

  // Server-side redirect to current month
  redirect(`/payroll/reports/monthly/${currentMonth}`);
}
