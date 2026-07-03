"use client";

import { IconChevronDown } from "@/components/ui/Icons";
import clsx from "clsx";

export function ScrollToBottom({
  visible,
  onClick,
  streaming,
}: {
  visible: boolean;
  onClick: () => void;
  streaming?: boolean;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "sticky bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 text-xs font-medium rounded-full shadow-glass no-print",
        "border border-stroke-default bg-surface-1/95 backdrop-blur-md",
        "inline-flex items-center gap-2 transition-all duration-200",
        streaming
          ? "text-accent border-accent/40 ring-2 ring-accent/20 motion-safe:animate-pulse"
          : "text-text-secondary hover:bg-surface-2",
      )}
      aria-label="Ir al final de la conversación"
    >
      <IconChevronDown className="w-4 h-4" />
      {streaming ? "Nueva respuesta…" : "Ir al final"}
    </button>
  );
}
