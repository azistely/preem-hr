/**
 * Salary Components Hooks
 *
 * React Query hooks for managing salary components:
 * - Standard components (super admin seeded)
 * - Component templates (curated library)
 * - Sector configurations
 * - Custom components (tenant-specific)
 */

import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

// ============================================================================
// Query Hooks (Data Fetching)
// ============================================================================

/**
 * Get standard salary components for a country
 */
export function useStandardComponents(countryCode: string, category?: string) {
  return trpc.salaryComponents.getStandardComponents.useQuery(
    { countryCode, category },
    {
      enabled: !!countryCode,
      staleTime: 1000 * 60 * 60, // 1 hour (standard components rarely change)
    }
  );
}

/**
 * Get component templates (popular or all)
 */
export function useComponentTemplates(countryCode: string, popularOnly = true) {
  return trpc.salaryComponents.getComponentTemplates.useQuery(
    { countryCode, popularOnly },
    {
      enabled: !!countryCode,
      staleTime: 1000 * 60 * 30, // 30 minutes
    }
  );
}

/**
 * Get sector configurations
 */
export function useSectorConfigurations(countryCode: string) {
  return trpc.salaryComponents.getSectorConfigurations.useQuery(
    { countryCode },
    {
      enabled: !!countryCode,
      staleTime: 1000 * 60 * 60, // 1 hour
    }
  );
}

/**
 * Get custom components for the current tenant
 */
export function useCustomComponents() {
  return trpc.salaryComponents.getCustomComponents.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutes (custom components change more frequently)
  });
}

// ============================================================================
// Mutation Hooks (Data Modification)
// ============================================================================

/**
 * Create a custom component
 */
export function useCreateCustomComponent() {
  const utils = trpc.useUtils();

  return trpc.salaryComponents.createCustomComponent.useMutation({
    onSuccess: (newComponent) => {
      toast.success(`Composant "${newComponent.name}" créé avec succès`);

      // Invalidate custom components list
      utils.salaryComponents.getCustomComponents.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création du composant');
    },
  });
}

/**
 * Add component from template (one-click)
 */
export function useAddFromTemplate() {
  const utils = trpc.useUtils();

  return trpc.salaryComponents.addFromTemplate.useMutation({
    onSuccess: (newComponent) => {
      toast.success(`Composant "${newComponent.name}" ajouté avec succès`);

      // Invalidate custom components list
      utils.salaryComponents.getCustomComponents.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'ajout du composant');
    },
  });
}

/**
 * Update a custom component
 */
export function useUpdateCustomComponent() {
  const utils = trpc.useUtils();

  return trpc.salaryComponents.updateCustomComponent.useMutation({
    onSuccess: (updated) => {
      toast.success(`Composant "${updated.name}" mis à jour`);

      // Invalidate custom components list
      utils.salaryComponents.getCustomComponents.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });
}

/**
 * Delete (soft delete) a custom component
 */
export function useDeleteCustomComponent() {
  const utils = trpc.useUtils();

  return trpc.salaryComponents.deleteCustomComponent.useMutation({
    onSuccess: () => {
      toast.success('Composant supprimé avec succès');

      // Invalidate custom components list
      utils.salaryComponents.getCustomComponents.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });
}

// ============================================================================
// Combined Hooks (For UI Components)
// ============================================================================

/**
 * Get all available components (standard + templates + custom)
 * Useful for dropdowns and selection UI
 */
export function useAllAvailableComponents(countryCode: string) {
  const { data: standard, isLoading: loadingStandard } =
    useStandardComponents(countryCode);
  const { data: templates, isLoading: loadingTemplates } =
    useComponentTemplates(countryCode);
  const { data: custom, isLoading: loadingCustom } = useCustomComponents();

  return {
    standard: standard || [],
    templates: templates || [],
    custom: custom || [],
    isLoading: loadingStandard || loadingTemplates || loadingCustom,
    totalCount: (standard?.length || 0) + (templates?.length || 0) + (custom?.length || 0),
  };
}

/**
 * Get popular templates for quick add
 * Useful for hire wizard "+ Add Custom Allowance" feature
 */
export function usePopularTemplates(countryCode: string) {
  return useComponentTemplates(countryCode, true);
}

/**
 * Get formula version history for a custom component
 */
export function useFormulaHistory(componentId: string, enabled = true) {
  return trpc.salaryComponents.getFormulaHistory.useQuery(
    { componentId, limit: 50 },
    {
      enabled: !!componentId && enabled,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );
}
