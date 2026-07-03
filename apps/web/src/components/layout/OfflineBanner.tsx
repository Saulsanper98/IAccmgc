"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    function onOffline() {
      setOffline(true);
    }
    function onOnline() {
      setOffline(false);
    }
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="shrink-0 px-4 py-2 text-sm text-center bg-status-warn/15 text-status-warn border-b border-status-warn/30"
      role="status"
      aria-live="polite"
    >
      Sin conexión — algunas funciones pueden no estar disponibles.
    </div>
  );
}
