"use client";

import { useCallback, useEffect, useState } from "react";

export type NavSidebarMode = "auto" | "collapsed" | "expanded";

const STORAGE_KEY = "wikibridge-nav-mode";

export function useNavSidebarMode() {
  const [mode, setModeState] = useState<NavSidebarMode>("auto");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "auto" || stored === "collapsed" || stored === "expanded") {
      setModeState(stored);
    }
  }, []);

  const setMode = useCallback((next: NavSidebarMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { mode, setMode };
}

export const NAV_MODE_LABELS: Record<NavSidebarMode, string> = {
  auto: "Automático",
  collapsed: "Contraído",
  expanded: "Expandido",
};
