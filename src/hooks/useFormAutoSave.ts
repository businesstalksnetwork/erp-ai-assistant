import { useEffect, useCallback, useRef } from "react";

const AUTOSAVE_INTERVAL = 30000; // 30 seconds

export function useFormAutoSave<T>(key: string, data: T, enabled = true) {
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const save = useCallback(() => {
    try {
      localStorage.setItem(`proerp_draft_${key}`, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {}
  }, [key, data]);

  const load = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(`proerp_draft_${key}`);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      // Expire after 24h
      if (Date.now() - parsed.savedAt > 86400000) {
        localStorage.removeItem(`proerp_draft_${key}`);
        return null;
      }
      return parsed.data as T;
    } catch {
      return null;
    }
  }, [key]);

  const clear = useCallback(() => {
    localStorage.removeItem(`proerp_draft_${key}`);
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    timerRef.current = setInterval(save, AUTOSAVE_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [save, enabled]);

  return { loadDraft: load, clearDraft: clear, saveDraft: save };
}
