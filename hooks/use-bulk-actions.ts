/**
 * useBulkActions Hook
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Reusable hook for bulk selection and batch operations
 * Design: Simple, type-safe, consistent UX across all bulk operations
 */

'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface BulkActionsHookOptions {
  onSuccess?: (count: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Generic hook for managing bulk actions on any entity type
 *
 * @example
 * ```tsx
 * const {
 *   selected,
 *   toggleSelect,
 *   selectAll,
 *   deselectAll,
 *   executeBulkAction,
 *   isProcessing
 * } = useBulkActions<Employee>();
 *
 * <Button onClick={() => executeBulkAction(
 *   async (ids) => await updateSalaries(ids),
 *   'Salaires mis à jour'
 * )}>
 *   Modifier les salaires ({selected.length})
 * </Button>
 * ```
 */
export function useBulkActions<T extends { id: string }>(
  options?: BulkActionsHookOptions
) {
  const [selected, setSelected] = useState<T[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Select all items
   */
  const selectAll = useCallback((items: T[]) => {
    setSelected(items);
  }, []);

  /**
   * Deselect all items
   */
  const deselectAll = useCallback(() => {
    setSelected([]);
  }, []);

  /**
   * Toggle selection for a single item
   */
  const toggleSelect = useCallback((item: T) => {
    setSelected((prev) => {
      const isSelected = prev.find((p) => p.id === item.id);
      if (isSelected) {
        return prev.filter((p) => p.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  }, []);

  /**
   * Check if an item is selected
   */
  const isSelected = useCallback(
    (itemId: string) => {
      return selected.some((s) => s.id === itemId);
    },
    [selected]
  );

  /**
   * Select multiple items at once
   */
  const selectMultiple = useCallback((items: T[]) => {
    setSelected((prev) => {
      const newItems = items.filter(
        (item) => !prev.find((p) => p.id === item.id)
      );
      return [...prev, ...newItems];
    });
  }, []);

  /**
   * Deselect multiple items at once
   */
  const deselectMultiple = useCallback((itemIds: string[]) => {
    setSelected((prev) => prev.filter((p) => !itemIds.includes(p.id)));
  }, []);

  /**
   * Execute a bulk action on selected items
   *
   * @param action - Async function that takes array of IDs and performs the action
   * @param successMessage - Message to show on success
   * @param options - Additional options for the action
   */
  const executeBulkAction = useCallback(
    async (
      action: (ids: string[]) => Promise<void>,
      successMessage: string,
      actionOptions?: {
        clearSelectionOnSuccess?: boolean;
        showToast?: boolean;
      }
    ) => {
      const {
        clearSelectionOnSuccess = true,
        showToast = true,
      } = actionOptions || {};

      if (selected.length === 0) {
        toast.error('Aucun élément sélectionné');
        return;
      }

      setIsProcessing(true);

      try {
        const ids = selected.map((s) => s.id);
        await action(ids);

        if (showToast) {
          toast.success(
            successMessage + ` (${selected.length} élément${selected.length > 1 ? 's' : ''})`
          );
        }

        if (clearSelectionOnSuccess) {
          deselectAll();
        }

        options?.onSuccess?.(selected.length);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Erreur inconnue');

        if (showToast) {
          toast.error(err.message || 'Erreur lors de l\'opération groupée');
        }

        options?.onError?.(err);
      } finally {
        setIsProcessing(false);
      }
    },
    [selected, deselectAll, options]
  );

  /**
   * Get selection statistics
   */
  const getSelectionStats = useCallback(() => {
    return {
      count: selected.length,
      ids: selected.map((s) => s.id),
      isEmpty: selected.length === 0,
    };
  }, [selected]);

  return {
    // State
    selected,
    isProcessing,

    // Selection methods
    selectAll,
    deselectAll,
    toggleSelect,
    isSelected,
    selectMultiple,
    deselectMultiple,

    // Action execution
    executeBulkAction,

    // Utilities
    getSelectionStats,
  };
}

/**
 * Hook for managing paginated bulk selection
 * Handles "select all on page" vs "select all in dataset"
 */
export function usePaginatedBulkActions<T extends { id: string }>(
  totalCount: number,
  options?: BulkActionsHookOptions
) {
  const bulkActions = useBulkActions<T>(options);
  const [selectAllMode, setSelectAllMode] = useState<'page' | 'all' | null>(null);

  /**
   * Select all items on current page
   */
  const selectAllOnPage = useCallback(
    (items: T[]) => {
      bulkActions.selectAll(items);
      setSelectAllMode('page');
    },
    [bulkActions]
  );

  /**
   * Select all items in dataset (beyond current page)
   */
  const selectAllInDataset = useCallback(() => {
    setSelectAllMode('all');
  }, []);

  /**
   * Clear selection and mode
   */
  const clearSelection = useCallback(() => {
    bulkActions.deselectAll();
    setSelectAllMode(null);
  }, [bulkActions]);

  /**
   * Get count of selected items
   * If "all" mode, returns total count instead of selected array length
   */
  const getSelectedCount = useCallback(() => {
    return selectAllMode === 'all' ? totalCount : bulkActions.selected.length;
  }, [selectAllMode, totalCount, bulkActions.selected.length]);

  return {
    ...bulkActions,
    deselectAll: clearSelection,

    // Paginated selection
    selectAllOnPage,
    selectAllInDataset,
    selectAllMode,
    getSelectedCount,
  };
}
