/**
 * useFormAutoSave Hook
 *
 * Automatically saves form data to localStorage to prevent data loss
 * on page refresh, network failures, or accidental navigation.
 *
 * Features:
 * - Debounced saves to avoid excessive writes
 * - Automatic restoration on mount
 * - Clear on successful submission
 * - Namespaced storage keys
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { UseFormReturn, FieldValues, Path } from 'react-hook-form';

interface UseFormAutoSaveOptions<TFormValues extends FieldValues> {
  /** Unique key to identify this form's data in localStorage */
  storageKey: string;
  /** React Hook Form instance */
  form: UseFormReturn<TFormValues>;
  /** Debounce delay in milliseconds (default: 1000) */
  debounceMs?: number;
  /** Fields to exclude from auto-save (e.g., sensitive data) */
  excludeFields?: Path<TFormValues>[];
  /** Called when data is restored from localStorage */
  onRestore?: (data: Partial<TFormValues>) => void;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

interface UseFormAutoSaveResult {
  /** Clear saved data from localStorage */
  clearSavedData: () => void;
  /** Check if there's saved data available */
  hasSavedData: boolean;
  /** Manually save current form data */
  saveNow: () => void;
  /** Timestamp of last save */
  lastSaved: Date | null;
}

const STORAGE_PREFIX = 'preem_form_';

/**
 * Gets the full storage key with prefix
 */
function getFullKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

/**
 * Safely get data from localStorage
 */
function getStoredData<T>(key: string): { data: T; timestamp: number } | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(getFullKey(key));
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    // Validate structure
    if (parsed && typeof parsed === 'object' && 'data' in parsed && 'timestamp' in parsed) {
      return parsed as { data: T; timestamp: number };
    }
    return null;
  } catch {
    // Invalid JSON or storage error
    return null;
  }
}

/**
 * Safely set data to localStorage
 */
function setStoredData<T>(key: string, data: T): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const payload = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(getFullKey(key), JSON.stringify(payload));
    return true;
  } catch {
    // Storage quota exceeded or other error
    console.warn('[useFormAutoSave] Failed to save to localStorage');
    return false;
  }
}

/**
 * Remove data from localStorage
 */
function removeStoredData(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(getFullKey(key));
  } catch {
    // Ignore errors
  }
}

export function useFormAutoSave<TFormValues extends FieldValues>({
  storageKey,
  form,
  debounceMs = 1000,
  excludeFields = [],
  onRestore,
  enabled = true,
}: UseFormAutoSaveOptions<TFormValues>): UseFormAutoSaveResult {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<Date | null>(null);
  const hasRestoredRef = useRef(false);

  // Filter out excluded fields from data
  const filterData = useCallback(
    (data: TFormValues): Partial<TFormValues> => {
      if (excludeFields.length === 0) return data;

      const filtered = { ...data };
      for (const field of excludeFields) {
        delete (filtered as Record<string, unknown>)[field as string];
      }
      return filtered;
    },
    [excludeFields]
  );

  // Save current form data
  const saveNow = useCallback(() => {
    if (!enabled) return;

    const values = form.getValues();
    const filteredData = filterData(values);
    const success = setStoredData(storageKey, filteredData);

    if (success) {
      lastSavedRef.current = new Date();
    }
  }, [enabled, form, filterData, storageKey]);

  // Clear saved data
  const clearSavedData = useCallback(() => {
    removeStoredData(storageKey);
    lastSavedRef.current = null;
  }, [storageKey]);

  // Check if saved data exists
  const hasSavedData = (() => {
    const stored = getStoredData<Partial<TFormValues>>(storageKey);
    return stored !== null;
  })();

  // Restore data on mount (only once)
  useEffect(() => {
    if (!enabled || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const stored = getStoredData<Partial<TFormValues>>(storageKey);
    if (!stored) return;

    // Check if data is not too old (24 hours max)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - stored.timestamp > maxAge) {
      removeStoredData(storageKey);
      return;
    }

    // Restore form values
    const restoredData = stored.data;

    // Reset form with restored values, merging with defaults
    const currentValues = form.getValues();
    const mergedValues = { ...currentValues, ...restoredData };

    // Use reset to properly set all values
    form.reset(mergedValues as TFormValues, {
      keepDefaultValues: false,
    });

    // Notify caller
    onRestore?.(restoredData);

    // Update last saved timestamp
    lastSavedRef.current = new Date(stored.timestamp);
  }, [enabled, storageKey, form, onRestore]);

  // Subscribe to form changes and debounce save
  useEffect(() => {
    if (!enabled) return;

    const subscription = form.watch(() => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounced save
      debounceTimerRef.current = setTimeout(() => {
        saveNow();
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, form, debounceMs, saveNow]);

  // Save before page unload
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      // Clear debounce and save immediately
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      saveNow();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, saveNow]);

  return {
    clearSavedData,
    hasSavedData,
    saveNow,
    lastSaved: lastSavedRef.current,
  };
}
