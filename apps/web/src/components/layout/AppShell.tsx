"use client";

import type { Session } from "next-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";
import { NavLink } from "./NavLink";
import { NavSidebarModeToggle } from "./NavSidebarModeToggle";
import { NavShellContext } from "./NavShellContext";
import { CommandPalette } from "./CommandPalette";
import { OfflineBanner } from "./OfflineBanner";
import { RoleBadge } from "@/components/ui/Badge";
import { useTheme } from "@/components/ui/ThemeProvider";
import { useNavSidebarMode } from "@/hooks/useNavSidebarMode";
import { ChatInstructionsModal } from "@/components/chat/ChatInstructionsModal";
import {
  IconChat,
  IconHealth,
  IconHome,
  IconMenu,
  IconMoon,
  IconRunbook,
  IconSettings,
  IconSparkles,
  IconSun,
} from "@/components/ui/Icons";
import clsx from "clsx";

interface AppShellProps {
  session: Session;
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Inicio", icon: IconHome, match: (p: string) => p === "/" },
  { href: "/chat", label: "Chat", icon: IconChat, match: (p: string) => p.startsWith("/chat") },
  {
    href: "/salud",
    label: "Salud",
    icon: IconHealth,
    match: (p: string) => p.startsWith("/salud"),
  },
  {
    href: "/runbooks",
    label: "Runbooks",
    icon: IconRunbook,
    match: (p: string) => p.startsWith("/runbooks"),
  },
  {
    href: "/admin",
    label: "Admin",
    icon: IconSettings,
    adminOnly: true,
    match: (p: string) => p.startsWith("/admin"),
  },
];

function healthLabel(status: "ok" | "degraded" | "down" | null) {
  if (status === "ok") return "Sistema operativo";
  if (status === "degraded") return "Sistema degradado";
  if (status === "down") return "Sistema no disponible";
  return "Comprobando estado…";
}

function useFocusTrap(open: boolean, containerRef: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    triggerRef.current = document.activeElement as HTMLElement;
    const container = containerRef.current;
    const focusables = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || focusables.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, containerRef, onClose]);
}

export function AppShell({ session, children }: AppShellProps) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { mode, setMode, isExpanded } = useNavSidebarMode();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"ok" | "degraded" | "down" | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isChat = pathname.startsWith("/chat");
  const isAdmin = session.user.role === "admin";
  const navCollapsed = !isExpanded;

  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  useFocusTrap(userMenuOpen, userMenuRef, closeUserMenu);

  const currentSection =
    navItems.find((item) => item.match(pathname) && (!item.adminOnly || isAdmin))?.label ?? "WikiBridge";

  useEffect(() => {
    setMobileNavOpen(false);
    setUserMenuOpen(false);
    document.body.style.overflow = isChat ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [pathname, isChat]);

  useEffect(() => {
    fetch("/api/backend/health")
      .then((r) => r.json())
      .then((d) => setHealthStatus(d.status))
      .catch(() => setHealthStatus("down"));
  }, []);

  const filteredNav = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <NavShellContext.Provider
      value={{
        openMobileNav: () => setMobileNavOpen(true),
        openInstructions: () => setInstructionsOpen(true),
      }}
    >
      <CommandPalette isAdmin={isAdmin} />
      <div className="flex min-h-screen w-full bg-surface-0">
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>

        <aside
          className={clsx(
            "nav-sidebar shrink-0 hidden md:flex flex-col z-40 no-print border-r border-stroke-subtle bg-surface-0",
            isExpanded && "nav-sidebar-expanded",
          )}
          aria-label="Navegación principal"
        >
          <div className={clsx("py-4", navCollapsed ? "px-2 flex justify-center" : "px-4")}>
            <Link
              href="/"
              className={clsx(
                "flex items-center text-text-primary no-underline hover:opacity-80 transition-opacity",
                navCollapsed ? "justify-center" : "gap-2.5",
              )}
              title="WikiBridge"
            >
              {navCollapsed ? (
                <span className="relative brand-title text-sm font-bold w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                  W
                  {healthStatus && (
                    <span
                      className={clsx(
                        "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-surface-0",
                        healthStatus === "ok" && "bg-status-ok",
                        healthStatus === "degraded" && "bg-status-warn",
                        healthStatus === "down" && "bg-status-error",
                      )}
                      aria-label={healthLabel(healthStatus)}
                    />
                  )}
                </span>
              ) : (
                <>
                  <span className="brand-title text-base font-semibold tracking-tight text-text-primary">
                    WikiBridge
                  </span>
                  {healthStatus && (
                    <span
                      className={clsx(
                        "w-2 h-2 rounded-full shrink-0",
                        healthStatus === "ok" && "bg-status-ok",
                        healthStatus === "degraded" && "bg-status-warn",
                        healthStatus === "down" && "bg-status-error",
                      )}
                      aria-label={healthLabel(healthStatus)}
                    />
                  )}
                </>
              )}
            </Link>
            {!navCollapsed && (
              <p className="text-[11px] text-text-muted mt-0.5">CCMGC · Sistemas</p>
            )}
          </div>

          <nav
            className={clsx(
              "flex-1 overflow-y-auto overflow-x-hidden py-2",
              navCollapsed ? "px-1.5 space-y-2" : "px-2 space-y-1.5",
            )}
          >
            {filteredNav.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={<item.icon className="w-4 h-4 shrink-0" />}
                active={item.match(pathname)}
                collapsed={navCollapsed}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div
            className={clsx(
              "border-t border-stroke-subtle space-y-2",
              navCollapsed ? "px-1.5 pt-3 pb-2" : "px-3 pt-4 pb-3",
            )}
          >
            <NavSidebarModeToggle mode={mode} onChange={setMode} collapsed={navCollapsed} />

            <div className="relative">
              <button
                type="button"
                className={clsx(
                  "list-row w-full",
                  navCollapsed && "justify-center !px-2 !gap-0",
                )}
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-controls="user-menu"
                title={navCollapsed ? session.user.name ?? "Usuario" : undefined}
              >
                <div className="avatar-circle bg-surface-2 text-text-secondary shrink-0">
                  {(session.user.name ?? "U")
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                {!navCollapsed && (
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-sm truncate">{session.user.name}</div>
                    <RoleBadge role={session.user.role ?? "lector"} />
                  </div>
                )}
              </button>

              {userMenuOpen && (
                <div
                  ref={userMenuRef}
                  id="user-menu"
                  role="menu"
                  aria-label="Menú de usuario"
                  className={clsx(
                    "absolute bottom-full mb-2 surface-card p-1 shadow-elevated z-50 min-w-[10rem]",
                    navCollapsed ? "left-0" : "left-3 right-3",
                  )}
                >
                  <button type="button" role="menuitem" onClick={toggle} className="list-row w-full text-sm">
                    {theme === "dark" ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
                    {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="list-row w-full text-sm"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setInstructionsOpen(true);
                    }}
                  >
                    <IconSparkles className="w-4 h-4" />
                    Instrucciones del asistente
                  </button>
                  <form action={signOutAction}>
                    <button type="submit" role="menuitem" className="list-row w-full text-sm text-status-error">
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </aside>

        {mobileNavOpen && (
          <>
            <button
              type="button"
              className="drawer-overlay no-print md:hidden"
              aria-label="Cerrar menú"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside
              className="drawer-panel animate-drawer-in w-[var(--nav-width)] md:hidden no-print"
              aria-label="Navegación principal"
            >
              <div className="px-4 py-5">
                <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileNavOpen(false)}>
                  <span className="brand-title text-base font-semibold">WikiBridge</span>
                </Link>
                <p className="text-[11px] text-text-muted mt-0.5">CCMGC · Sistemas</p>
              </div>
              <nav className="flex-1 px-2 py-2 space-y-1.5 overflow-y-auto">
                {filteredNav.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    icon={<item.icon className="w-4 h-4 shrink-0" />}
                    active={item.match(pathname)}
                    mobile
                    onNavigate={() => setMobileNavOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="p-3 pt-4 border-t border-stroke-subtle space-y-2">
                <NavSidebarModeToggle mode={mode} onChange={setMode} collapsed={false} />
                <button type="button" onClick={toggle} className="list-row w-full text-sm">
                  {theme === "dark" ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
                  {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                </button>
                <form action={signOutAction}>
                  <button type="submit" className="list-row w-full text-sm text-status-error">
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </aside>
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <OfflineBanner />
          {!isChat && (
            <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-stroke-subtle no-print md:hidden">
              <button
                type="button"
                className="btn-icon"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Menú de navegación"
                aria-expanded={mobileNavOpen}
              >
                <IconMenu />
              </button>
              <h1 className="text-sm font-semibold truncate flex-1">{currentSection}</h1>
            </header>
          )}

          <main
            id="main-content"
            className={clsx(
              "flex-1 min-w-0 flex flex-col",
              isChat ? "h-dvh max-h-dvh overflow-hidden" : "min-h-0 overflow-auto",
            )}
          >
            {isChat ? (
              children
            ) : (
              <div className="max-w-6xl mx-auto px-5 py-8 md:px-10 md:py-12 w-full flex-1">{children}</div>
            )}
          </main>
        </div>
      </div>
      <ChatInstructionsModal
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        isAdmin={isAdmin}
      />
    </NavShellContext.Provider>
  );
}
