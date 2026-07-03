"use client";

import { useCallback, useEffect, useState } from "react";

export type NavSidebarMode = "collapsed" | "expanded";

const STORAGE_KEY = "wikibridge-nav-mode";

export function useNavSidebarMode() {
  const [mode, setModeState] = useState<NavSidebarMode>("collapsed");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "collapsed" || stored === "expanded") {
      setModeState(stored);
    } else if (stored === "auto") {
      setModeState("collapsed");
      localStorage.setItem(STORAGE_KEY, "collapsed");
    }
  }, []);

  const setMode = useCallback((next: NavSidebarMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const isExpanded = mode === "expanded";

  return { mode, setMode, isExpanded };
}

export const NAV_MODE_LABELS: Record<NavSidebarMode, string> = {
  collapsed: "Contraído",
  expanded: "Expandido",
};
