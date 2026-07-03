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
        title={collapsed ? String(children) : "No disponible"}
        aria-disabled="true"
      >
        {icon}
        {!collapsed && <span className="truncate flex-1">{children}</span>}
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
        collapsed && "justify-center !px-2 !gap-0",
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {!collapsed && <span className="truncate flex-1">{children}</span>}
      {!collapsed && badge && (
        <Badge variant="muted" className="shrink-0">
          {badge}
        </Badge>
      )}
    </Link>
  );
}
