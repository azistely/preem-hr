/**
 * useCountryFields Hook
 *
 * Returns country-specific field labels, placeholders, and validation rules
 * based on the current tenant's country code.
 *
 * Used to adapt company information forms to show country-appropriate
 * terminology (e.g., "CNPS" for CI, "IPRES" for SN).
 */

import { api } from "@/server/api/client";
import { getCountryFieldConfig, type CountryFieldConfig } from "@/lib/config/country-fields";

export function useCountryFields(): CountryFieldConfig & { isLoading: boolean } {
  // Get current tenant to determine country
  const { data: tenant, isLoading } = api.tenant.getCurrent.useQuery();

  const countryCode = tenant?.countryCode || 'CI';
  const config = getCountryFieldConfig(countryCode);

  return {
    ...config,
    isLoading,
  };
}
