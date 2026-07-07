"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_QUICK_SHORTCUTS,
  type QuickShortcut,
} from "@/config/app-navigation";

const STORAGE_PREFIX = "quick-shortcuts";

function storageKey(userId: string | undefined): string {
  return userId ? `${STORAGE_PREFIX}:${userId}` : `${STORAGE_PREFIX}:guest`;
}

function parseStored(raw: string | null): QuickShortcut[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuickShortcut[];
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item) =>
        typeof item.id === "string" &&
        typeof item.href === "string" &&
        typeof item.label === "string",
    );
  } catch {
    return null;
  }
}

export function useQuickShortcuts(userId: string | undefined) {
  const [shortcuts, setShortcuts] = useState<QuickShortcut[]>(DEFAULT_QUICK_SHORTCUTS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = parseStored(localStorage.getItem(storageKey(userId)));
    setShortcuts(stored ?? DEFAULT_QUICK_SHORTCUTS);
    setIsLoaded(true);
  }, [userId]);

  const persist = useCallback(
    (next: QuickShortcut[]) => {
      setShortcuts(next);
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
    },
    [userId],
  );

  const addShortcut = useCallback(
    (shortcut: QuickShortcut) => {
      persist([...shortcuts, shortcut]);
    },
    [shortcuts, persist],
  );

  const removeShortcut = useCallback(
    (id: string) => {
      persist(shortcuts.filter((item) => item.id !== id));
    },
    [shortcuts, persist],
  );

  const updateShortcut = useCallback(
    (id: string, patch: Partial<Pick<QuickShortcut, "href" | "label">>) => {
      persist(
        shortcuts.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      );
    },
    [shortcuts, persist],
  );

  const resetToDefaults = useCallback(() => {
    persist(DEFAULT_QUICK_SHORTCUTS);
  }, [persist]);

  return {
    shortcuts,
    isLoaded,
    addShortcut,
    removeShortcut,
    updateShortcut,
    resetToDefaults,
  };
}
