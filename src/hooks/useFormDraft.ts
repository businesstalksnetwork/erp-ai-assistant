import { useEffect, useRef, useCallback } from 'react';

const DRAFT_PREFIX = 'erpai_draft_';
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DraftMeta<T> {
  data: T;
  savedAt: number;
  companyId?: string;
}

/**
 * Auto-saves form data to localStorage and restores it on mount.
 * 
 * @param key - Unique key for this form (e.g., 'new-invoice', 'edit-invoice-{id}')
 * @param data - Current form data object
 * @param setData - Setter function to restore saved data
 * @param options - Optional config
 * @returns { clearDraft, hasDraft }
 */
export function useFormDraft<T>(
  key: string,
  data: T,
  setData: (data: T) => void,
  options?: {
    companyId?: string;
    debounceMs?: number;
    enabled?: boolean;
    onRestore?: () => void;
  }
) {
  const { companyId, debounceMs = 500, enabled = true, onRestore } = options || {};
  const fullKey = DRAFT_PREFIX + key;
  const isInitialLoad = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);

  // Restore draft on mount (only once)
  useEffect(() => {
    if (!enabled || restoredRef.current) return;
    restoredRef.current = true;

    try {
      const raw = localStorage.getItem(fullKey);
      if (!raw) return;

      const meta: DraftMeta<T> = JSON.parse(raw);

      // Check expiry
      if (Date.now() - meta.savedAt > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(fullKey);
        return;
      }

      // Check company match
      if (companyId && meta.companyId && meta.companyId !== companyId) {
        localStorage.removeItem(fullKey);
        return;
      }

      setData(meta.data);
      onRestore?.();
    } catch {
      localStorage.removeItem(fullKey);
    }
  }, [fullKey, enabled, companyId]);

  // Auto-save with debounce (skip initial load)
  useEffect(() => {
    if (!enabled) return;

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      try {
        const meta: DraftMeta<T> = {
          data,
          savedAt: Date.now(),
          companyId,
        };
        localStorage.setItem(fullKey, JSON.stringify(meta));
      } catch {
        // localStorage full or quota exceeded - silently fail
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [data, fullKey, enabled, companyId, debounceMs]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(fullKey);
  }, [fullKey]);

  const hasDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (!raw) return false;
      const meta: DraftMeta<T> = JSON.parse(raw);
      if (Date.now() - meta.savedAt > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(fullKey);
        return false;
      }
      if (companyId && meta.companyId && meta.companyId !== companyId) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, [fullKey, companyId]);

  return { clearDraft, hasDraft };
}
