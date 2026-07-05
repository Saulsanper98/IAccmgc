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
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (items.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(items.length - 1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const item = items[activeIndex];
        if (item) {
          setOpen(false);
          item.onClick();
        }
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, items, activeIndex]);

  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

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
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={clsx(
                "list-row w-full text-sm rounded-md !min-h-[36px]",
                item.destructive && "text-status-error",
                index === activeIndex && "bg-surface-2",
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
