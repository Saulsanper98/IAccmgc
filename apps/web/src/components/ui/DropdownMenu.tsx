"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { IconMoreVertical } from "./Icons";

export interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

export function DropdownMenu({
  items,
  disabled,
  align = "right",
  label = "Más acciones",
}: {
  items: DropdownMenuItem[];
  disabled?: boolean;
  align?: "left" | "right";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="btn-icon !min-h-[36px] !min-w-[36px] rounded-full"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <IconMoreVertical />
      </button>

      {open && (
        <div
          role="menu"
          className={clsx(
            "absolute z-50 min-w-[11rem] surface-card-elevated p-1 shadow-elevated animate-toast-in",
            align === "right" ? "right-0" : "left-0",
            "top-full mt-1",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={clsx(
                "list-row w-full text-sm rounded-md !min-h-[36px]",
                item.destructive && "text-status-error",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
