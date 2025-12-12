/**
 * Competencies Settings Page (Performance Module)
 *
 * Redirects to the main competencies catalog page.
 * This is kept separate for navigation structure.
 */

import { redirect } from 'next/navigation';

export default function CompetenciesSettingsPage() {
  // Redirect to the main competencies catalog
  redirect('/competencies');
}
