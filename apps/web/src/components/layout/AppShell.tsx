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
import { useFocusTrap } from "@/hooks/useFocusTrap";
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

const NAV_AUTO_HINT_KEY = "wikibridge-nav-auto-hint-seen";

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

function HealthDot({ status, className }: { status: "ok" | "degraded" | "down"; className?: string }) {
  return (
    <span
      className={clsx(
        "w-2 h-2 rounded-full shrink-0",
        status === "ok" && "bg-status-ok",
        status === "degraded" && "bg-status-warn",
        status === "down" && "bg-status-error",
        className,
      )}
      aria-label={healthLabel(status)}
    />
  );
}

function SidebarNavContent({
  pathname,
  filteredNav,
  adminPendingBadge,
  navCollapsed,
  mobile,
  onNavigate,
  healthStatus,
}: {
  pathname: string;
  filteredNav: typeof navItems;
  adminPendingBadge?: string;
  navCollapsed: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  healthStatus: "ok" | "degraded" | "down" | null;
}) {
  return (
    <>
      <div className={clsx("py-4", navCollapsed ? "px-2 flex justify-center" : "px-4")}>
        <Link
          href="/"
          className={clsx(
            "flex items-center text-text-primary no-underline hover:opacity-80 transition-opacity",
            navCollapsed ? "justify-center" : "gap-2.5",
          )}
          title="WikiBridge"
          onClick={onNavigate}
        >
          {navCollapsed ? (
            <span className="relative brand-title text-sm font-bold w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
              W
              {healthStatus && (
                <HealthDot
                  status={healthStatus}
                  className="absolute -top-0.5 -right-0.5 ring-2 ring-surface-0"
                />
              )}
            </span>
          ) : (
            <>
              <span className="brand-title text-base font-semibold tracking-tight text-text-primary">
                WikiBridge
              </span>
              {healthStatus && <HealthDot status={healthStatus} />}
            </>
          )}
        </Link>
        {!navCollapsed && <p className="meta-caption mt-0.5">CCMGC · Sistemas</p>}
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
            mobile={mobile}
            onNavigate={onNavigate}
            badge={item.href === "/admin" ? adminPendingBadge : undefined}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export function AppShell({ session, children }: AppShellProps) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { mode, setMode, isLayoutExpanded, isFlyout, navCollapsed, onNavEnter, onNavLeave } =
    useNavSidebarMode();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"ok" | "degraded" | "down" | null>(null);
  const [adminPendingCount, setAdminPendingCount] = useState<number | null>(null);
  const [showAutoHint, setShowAutoHint] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const isChat = pathname.startsWith("/chat");
  const isAdmin = session.user.role === "admin";

  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  useFocusTrap(userMenuOpen, userMenuRef, closeUserMenu, { restoreFocus: false });

  useEffect(() => {
    if (mode !== "auto" || typeof window === "undefined") return;
    if (localStorage.getItem(NAV_AUTO_HINT_KEY)) return;
    setShowAutoHint(true);
    const t = setTimeout(() => {
      localStorage.setItem(NAV_AUTO_HINT_KEY, "1");
      setShowAutoHint(false);
    }, 8000);
    return () => clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    if (!userMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (userMenuRef.current?.contains(target)) return;
      if (userMenuTriggerRef.current?.contains(target)) return;
      setUserMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [userMenuOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

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

  const refreshPendingCount = useCallback(() => {
    if (!isAdmin) return;
    fetch("/api/admin/validated-qa/pending-count")
      .then((r) => (r.ok ? r.json() : { pending: 0 }))
      .then((d) => setAdminPendingCount(typeof d.pending === "number" ? d.pending : 0))
      .catch(() => setAdminPendingCount(null));
  }, [isAdmin]);

  useEffect(() => {
    refreshPendingCount();
    if (!isAdmin) return;
    const id = setInterval(refreshPendingCount, 60_000);
    return () => clearInterval(id);
  }, [isAdmin, refreshPendingCount]);

  useEffect(() => {
    function onPendingCount(event: Event) {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === "number") setAdminPendingCount(detail);
    }
    window.addEventListener("validated-qa-pending-count", onPendingCount);
    return () => window.removeEventListener("validated-qa-pending-count", onPendingCount);
  }, []);

  const filteredNav = navItems.filter((item) => !item.adminOnly || isAdmin);
  const adminPendingBadge =
    adminPendingCount != null && adminPendingCount > 0 ? String(adminPendingCount) : undefined;

  const sidebarFooter = (collapsed: boolean) => (
    <div
      className={clsx(
        "border-t border-stroke-subtle space-y-2",
        collapsed ? "px-1.5 pt-3 pb-2" : "px-3 pt-4 pb-3",
      )}
    >
      {!collapsed && (
        <p className="meta-caption px-1 hidden lg:block">
          <kbd className="px-1 py-0.5 rounded bg-surface-2 text-[10px]">Ctrl</kbd>+
          <kbd className="px-1 py-0.5 rounded bg-surface-2 text-[10px]">K</kbd> navegar
        </p>
      )}
      <NavSidebarModeToggle mode={mode} onChange={setMode} collapsed={collapsed} />
      {showAutoHint && mode === "auto" && !collapsed && (
        <p className="meta-caption px-1 text-link animate-pulse">Pasa el ratón para ver etiquetas</p>
      )}

      <div className="relative">
        <button
          ref={userMenuTriggerRef}
          type="button"
          className={clsx("list-row w-full", collapsed && "justify-center !px-2 !gap-0")}
          onClick={() => setUserMenuOpen((v) => !v)}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
          aria-controls="user-menu"
          title={collapsed ? session.user.name ?? "Usuario" : undefined}
        >
          <div className="avatar-circle bg-surface-2 text-text-secondary shrink-0">
            {(session.user.name ?? "U")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          {!collapsed && (
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
              collapsed ? "left-0" : "left-3 right-3",
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
  );

  return (
    <NavShellContext.Provider
      value={{
        openMobileNav: () => setMobileNavOpen(true),
        openInstructions: () => setInstructionsOpen(true),
      }}
    >
      <CommandPalette isAdmin={isAdmin} />
      <div className="flex min-h-screen w-full bg-surface-0">
        <a
          href={isChat ? "#chat-input" : "#main-content"}
          className="skip-link"
        >
          {isChat ? "Saltar al campo de pregunta" : "Saltar al contenido principal"}
        </a>

        {/* Rail: always collapsed width in auto/collapsed modes */}
        <aside
          ref={sidebarRef}
          className={clsx(
            "nav-sidebar shrink-0 hidden md:flex flex-col z-40 no-print border-r border-stroke-subtle bg-surface-0",
            isLayoutExpanded && "nav-sidebar-expanded",
            mode === "auto" && "nav-sidebar-rail",
          )}
          aria-label="Navegación principal"
          onMouseEnter={onNavEnter}
          onMouseLeave={onNavLeave}
        >
          <SidebarNavContent
            pathname={pathname}
            filteredNav={filteredNav}
            adminPendingBadge={adminPendingBadge}
            navCollapsed={navCollapsed}
            healthStatus={healthStatus}
          />
          {sidebarFooter(navCollapsed)}
        </aside>

        {/* Flyout overlay for auto mode — no layout shift */}
        {isFlyout && (
          <aside
            className="nav-sidebar-flyout hidden md:flex flex-col no-print"
            aria-label="Navegación expandida"
            onMouseEnter={onNavEnter}
            onMouseLeave={() => {
              onNavLeave();
              setUserMenuOpen(false);
            }}
          >
            <SidebarNavContent
              pathname={pathname}
              filteredNav={filteredNav}
              adminPendingBadge={adminPendingBadge}
              navCollapsed={false}
              healthStatus={healthStatus}
            />
            {sidebarFooter(false)}
          </aside>
        )}

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
                <Link
                  href="/"
                  className="flex items-center gap-2.5"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <span className="brand-title text-base font-semibold">WikiBridge</span>
                  {healthStatus && <HealthDot status={healthStatus} />}
                </Link>
                <p className="meta-caption mt-0.5">CCMGC · Sistemas</p>
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
                    badge={item.href === "/admin" ? adminPendingBadge : undefined}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="p-3 pt-4 border-t border-stroke-subtle space-y-2">
                <div className="list-row w-full !py-2">
                  <div className="avatar-circle bg-surface-2 text-text-secondary shrink-0">
                    {(session.user.name ?? "U")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-sm truncate">{session.user.name}</div>
                    <RoleBadge role={session.user.role ?? "lector"} />
                  </div>
                </div>
                <NavSidebarModeToggle mode={mode} onChange={setMode} collapsed={false} />
                <button type="button" onClick={toggle} className="list-row w-full text-sm">
                  {theme === "dark" ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
                  {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                </button>
                <button
                  type="button"
                  className="list-row w-full text-sm"
                  onClick={() => {
                    setMobileNavOpen(false);
                    setInstructionsOpen(true);
                  }}
                >
                  <IconSparkles className="w-4 h-4" />
                  Instrucciones del asistente
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
