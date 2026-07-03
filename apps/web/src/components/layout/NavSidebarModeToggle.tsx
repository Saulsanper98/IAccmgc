"use client";

import { useState } from "react";
import clsx from "clsx";
import type { NavSidebarMode } from "@/hooks/useNavSidebarMode";
import { NAV_MODE_LABELS } from "@/hooks/useNavSidebarMode";
import { IconNavCollapsed, IconNavExpanded } from "@/components/ui/Icons";

const MODES: NavSidebarMode[] = ["collapsed", "expanded"];

const MODE_ICONS = {
  collapsed: IconNavCollapsed,
  expanded: IconNavExpanded,
} as const;

export function NavSidebarModeToggle({
  mode,
  onChange,
  collapsed,
}: {
  mode: NavSidebarMode;
  onChange: (mode: NavSidebarMode) => void;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ActiveIcon = MODE_ICONS[mode];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex items-center gap-2 w-full rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-1 transition-colors",
          collapsed ? "justify-center p-2 min-h-[36px]" : "px-3 py-2 min-h-[36px] text-sm",
        )}
        aria-label={`Modo del menú: ${NAV_MODE_LABELS[mode]}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <ActiveIcon className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="truncate flex-1 text-left">{NAV_MODE_LABELS[mode]}</span>}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Cerrar menú de modo"
            onClick={() => setOpen(false)}
          />
          <div
            className={clsx(
              "absolute bottom-full mb-1 surface-card-elevated p-1 shadow-elevated z-50 min-w-[11rem] animate-toast-in",
              collapsed ? "left-0" : "left-0 right-0",
            )}
            role="menu"
          >
            {MODES.map((m) => {
              const Icon = MODE_ICONS[m];
              return (
                <button
                  key={m}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                  className={clsx(
                    "list-row w-full text-sm rounded-md !min-h-[36px]",
                    mode === m && "bg-surface-2 text-text-primary",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {NAV_MODE_LABELS[m]}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
