"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Single shared poller — avoids duplicate refresh intervals when scan is active. */
export function HealthScanPoller({ active }: { active: boolean }) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => router.refresh(), 5000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, router]);

  return null;
}
