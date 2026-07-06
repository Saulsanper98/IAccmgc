"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { IconAlertCircle, IconCheck, IconClose, IconInfo } from "@/components/ui/Icons";
import clsx from "clsx";

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

const TOAST_CONFIG: Record<
  ToastType,
  { Icon: typeof IconCheck; iconClass: string; label: string }
> = {
  success: { Icon: IconCheck, iconClass: "toast-item-icon--success", label: "Éxito" },
  error: { Icon: IconAlertCircle, iconClass: "toast-item-icon--error", label: "Error" },
  info: { Icon: IconInfo, iconClass: "toast-item-icon--info", label: "Información" },
};

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
      <div className="toast-stack" aria-live="polite" aria-relevant="additions" aria-atomic="true">
        {toasts.map((t) => {
          const { Icon, iconClass, label } = TOAST_CONFIG[t.type];
          return (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              aria-live={t.type === "error" ? "assertive" : "polite"}
              onMouseEnter={() => pauseDismiss(t.id)}
              onMouseLeave={() => scheduleDismiss(t.id)}
              onFocus={() => pauseDismiss(t.id)}
              onBlur={() => scheduleDismiss(t.id)}
              className="toast-item"
            >
              <span className={clsx("toast-item-icon", iconClass)} aria-hidden>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="toast-item-message">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="toast-item-close btn-icon !min-h-8 !min-w-8"
                aria-label={`Cerrar notificación: ${label}`}
              >
                <IconClose className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
