/**
 * Competencies Catalog Page
 *
 * Redirects to the main competencies page which already
 * serves as the catalog view.
 */

import { redirect } from 'next/navigation';

export default function CompetenciesCatalogPage() {
  redirect('/competencies');
}
