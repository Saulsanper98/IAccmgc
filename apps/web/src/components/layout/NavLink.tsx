"use client";

import Link from "next/link";
import clsx from "clsx";
import { Badge } from "@/components/ui/Badge";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  badge?: string;
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}

export function NavLink({
  href,
  children,
  icon,
  disabled,
  active,
  badge,
  collapsed,
  mobile,
  onNavigate,
}: NavLinkProps) {
  if (disabled) {
    return (
      <span
        className={clsx(
          "list-row text-text-muted cursor-not-allowed opacity-50",
          collapsed && "justify-center !px-2",
        )}
        title={collapsed ? String(children) : undefined}
        aria-disabled="true"
      >
        {icon}
        {!collapsed && <span className="truncate flex-1">{children}</span>}
        <span className="sr-only">No disponible</span>
        {!collapsed && badge && (
          <Badge variant="muted" className="shrink-0">
            {badge}
          </Badge>
        )}
      </span>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? String(children) : undefined}
      className={clsx(
        "nav-pill",
        active
          ? mobile
            ? "nav-pill-active-mobile"
            : "nav-pill-active"
          : "nav-pill-inactive",
        collapsed && "justify-center !px-2 !gap-0 relative",
        collapsed && active && "ring-2 ring-link/40 ring-inset",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className={clsx("shrink-0", collapsed && badge && "relative")}>
        {icon}
        {collapsed && badge && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-status-warn text-xs font-semibold text-black flex items-center justify-center leading-none"
            aria-label={`${badge} pendientes`}
          >
            {badge}
          </span>
        )}
      </span>
      {!collapsed && <span className="truncate flex-1">{children}</span>}
      {!collapsed && badge && (
        <Badge variant="muted" className="shrink-0">
          {badge}
        </Badge>
      )}
    </Link>
  );
}
