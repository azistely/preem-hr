/**
 * Marketing Homepage - Burkina Faso
 *
 * Country-specific homepage for Burkina Faso
 * Features: IUTS, CNSS, SMIG 34,664 FCFA
 */

import { CountryHomepage } from '@/components/marketing/country-homepage';
import { COUNTRIES, AVAILABLE_COUNTRIES } from '@/lib/config/countries';

export default function BurkinaFasoHomePage() {
  return (
    <CountryHomepage
      country={COUNTRIES.bf}
      availableCountries={AVAILABLE_COUNTRIES}
    />
  );
}
