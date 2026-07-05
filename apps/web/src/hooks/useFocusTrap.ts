"use client";

import { useEffect, useRef } from "react";

export function useFocusTrap(
  open: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  options?: { restoreFocus?: boolean },
) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const restoreFocus = options?.restoreFocus ?? true;

  useEffect(() => {
    if (!open || !containerRef.current) return;

    triggerRef.current = document.activeElement as HTMLElement;
    const container = containerRef.current;

    function getFocusables() {
      return container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
    }

    const focusables = getFocusables();
    focusables[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = getFocusables();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (restoreFocus) triggerRef.current?.focus();
    };
  }, [open, containerRef, onClose, restoreFocus]);
}
