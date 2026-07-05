"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NavSidebarMode = "auto" | "collapsed" | "expanded";

const STORAGE_KEY = "wikibridge-nav-mode";
const HOVER_LEAVE_MS = 120;

export function useNavSidebarMode() {
  const [mode, setModeState] = useState<NavSidebarMode>("auto");
  const [hovered, setHovered] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "auto" || stored === "collapsed" || stored === "expanded") {
      setModeState(stored);
    }
    setHydrated(true);
  }, []);

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current !== null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const setMode = useCallback(
    (next: NavSidebarMode) => {
      clearLeaveTimer();
      setHovered(false);
      setModeState(next);
      localStorage.setItem(STORAGE_KEY, next);
    },
    [clearLeaveTimer],
  );

  const onNavEnter = useCallback(() => {
    if (mode !== "auto") return;
    clearLeaveTimer();
    setHovered(true);
  }, [mode, clearLeaveTimer]);

  const onNavLeave = useCallback(() => {
    if (mode !== "auto") return;
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => {
      setHovered(false);
      leaveTimerRef.current = null;
    }, HOVER_LEAVE_MS);
  }, [mode, clearLeaveTimer]);

  useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

  const isLayoutExpanded = mode === "expanded";
  const isFlyout = mode === "auto" && hovered;
  const navCollapsed = !isLayoutExpanded && !isFlyout;

  return {
    mode,
    setMode,
    hydrated,
    isLayoutExpanded,
    isFlyout,
    navCollapsed,
    onNavEnter,
    onNavLeave,
  };
}

export const NAV_MODE_LABELS: Record<NavSidebarMode, string> = {
  auto: "Automático",
  collapsed: "Contraído",
  expanded: "Expandido",
};
