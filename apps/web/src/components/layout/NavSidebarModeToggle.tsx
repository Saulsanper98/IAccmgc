"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import type { NavSidebarMode } from "@/hooks/useNavSidebarMode";
import { NAV_MODE_LABELS } from "@/hooks/useNavSidebarMode";
import { IconNavAuto, IconNavCollapsed, IconNavExpanded } from "@/components/ui/Icons";
import { AnchoredMenu } from "./AnchoredMenu";

const MODES: NavSidebarMode[] = ["auto", "collapsed", "expanded"];

const MODE_ICONS = {
  auto: IconNavAuto,
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const ActiveIcon = MODE_ICONS[mode];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
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

      <AnchoredMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        align={collapsed ? "left" : "stretch"}
        ariaLabel="Modo del menú lateral"
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
      </AnchoredMenu>
    </div>
  );
}
