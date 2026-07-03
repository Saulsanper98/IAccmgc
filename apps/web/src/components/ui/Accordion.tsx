"use client";

import clsx from "clsx";
import { useId, useState } from "react";
import { IconChevronDown } from "./Icons";

export function Accordion({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={clsx("border border-stroke-subtle rounded-lg overflow-hidden", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-surface-1/60 transition-colors"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <IconChevronDown
          className={clsx("w-4 h-4 text-text-muted shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      <div
        id={panelId}
        role="region"
        hidden={!open}
        className={clsx("px-4 pb-4 border-t border-stroke-subtle", !open && "hidden")}
      >
        {children}
      </div>
    </div>
  );
}
