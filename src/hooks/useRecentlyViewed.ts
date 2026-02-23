import { useState, useEffect, useCallback } from "react";

interface RecentItem {
  path: string;
  label: string;
  module: string;
  timestamp: number;
}

const STORAGE_KEY = "proerp_recently_viewed";
const MAX_ITEMS = 10;

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const addItem = useCallback((path: string, label: string, module: string) => {
    setItems((prev) => {
      const filtered = prev.filter((i) => i.path !== path);
      const next = [{ path, label, module, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      return next;
    });
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recentItems: items, addRecentItem: addItem, clearRecentItems: clearItems };
}
