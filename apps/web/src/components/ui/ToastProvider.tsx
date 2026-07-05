"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import clsx from "clsx";
import { IconClose } from "@/components/ui/Icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;
const TOAST_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: number) => {
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => dismiss(id), TOAST_DURATION_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  const pauseDismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Date.now();
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, type }]);
      scheduleDismiss(id);
    },
    [scheduleDismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-md px-4 pointer-events-none"
        aria-live="polite"
        aria-relevant="additions"
        aria-atomic="true"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            aria-live={t.type === "error" ? "assertive" : "polite"}
            onMouseEnter={() => pauseDismiss(t.id)}
            onMouseLeave={() => scheduleDismiss(t.id)}
            onFocus={() => pauseDismiss(t.id)}
            onBlur={() => scheduleDismiss(t.id)}
            className={clsx(
              "surface-card-elevated pl-4 pr-2 py-3 text-sm animate-toast-in pointer-events-auto flex items-center gap-2",
              t.type === "success" && "border-l-2 border-status-ok",
              t.type === "error" && "border-l-2 border-status-error",
              t.type === "info" && "border-l-2 border-link",
            )}
          >
            <span className="flex-1 text-center">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="btn-icon !min-h-[32px] !min-w-[32px] shrink-0"
              aria-label="Cerrar notificación"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
