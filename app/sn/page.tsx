/**
 * Marketing Homepage - Sénégal
 *
 * Country-specific homepage for Senegal
 * Features: IRPP, IPRES, SMIG 52,500 FCFA
 */

import { CountryHomepage } from '@/components/marketing/country-homepage';
import { COUNTRIES, AVAILABLE_COUNTRIES } from '@/lib/config/countries';

export default function SenegalHomePage() {
  return (
    <CountryHomepage
      country={COUNTRIES.sn}
      availableCountries={AVAILABLE_COUNTRIES}
    />
  );
}
