/**
 * Marketing Homepage - Côte d'Ivoire (Default)
 *
 * Main entry point redirects to country-specific homepage
 * Default: Côte d'Ivoire
 *
 * Handles authenticated user detection and redirect to dashboard
 */

'use client';

import { CountryHomepage } from '@/components/marketing/country-homepage';
import { COUNTRIES, AVAILABLE_COUNTRIES } from '@/lib/config/countries';

export default function HomePage() {
  return (
    <CountryHomepage
      country={COUNTRIES.ci}
      availableCountries={AVAILABLE_COUNTRIES}
    />
  );
}
