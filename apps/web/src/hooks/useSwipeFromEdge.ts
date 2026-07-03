"use client";

import { useEffect, useRef } from "react";

export function useSwipeFromEdge(onSwipe: () => void, edgeWidth = 24) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      if (touch.clientX <= edgeWidth) {
        startRef.current = { x: touch.clientX, y: touch.clientY };
      } else {
        startRef.current = null;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);
      if (dx > 60 && dy < 80) onSwipe();
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [onSwipe, edgeWidth]);
}
