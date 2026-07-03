"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";

interface CommandItem {
  id: string;
  label: string;
  href: string;
  keywords?: string;
}

const COMMANDS: CommandItem[] = [
  { id: "home", label: "Inicio", href: "/", keywords: "home inicio" },
  { id: "chat", label: "Chat", href: "/chat", keywords: "chat conversación preguntar" },
  { id: "salud", label: "Salud documental", href: "/salud", keywords: "salud health hallazgos" },
  { id: "runbooks", label: "Runbooks", href: "/runbooks", keywords: "runbooks procedimientos" },
  { id: "admin", label: "Administración", href: "/admin", keywords: "admin ingesta sync" },
];

export function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = COMMANDS.filter((item) => item.id !== "admin" || isAdmin).filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.keywords?.toLowerCase().includes(q)
    );
  });

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
      } else if (e.key === "Enter" && items[activeIndex]) {
        e.preventDefault();
        navigate(items[activeIndex].href);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, items, activeIndex, close, navigate]);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
        aria-label="Cerrar paleta de comandos"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navegación rápida"
        className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[100] w-full max-w-md mx-4 surface-card-elevated shadow-elevated overflow-hidden"
      >
        <div className="p-3 border-b border-stroke-subtle">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ir a…"
            className="input-field !min-h-[40px] text-sm"
            aria-label="Buscar sección"
            autoComplete="off"
          />
          <p className="meta-caption mt-2 px-1">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px]">↑↓</kbd> navegar ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px]">Enter</kbd> ir ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px]">Esc</kbd> cerrar
          </p>
        </div>
        <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
          {items.length === 0 ? (
            <li className="px-3 py-4 text-sm text-text-muted text-center">Sin resultados</li>
          ) : (
            items.map((item, index) => (
              <li key={item.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onClick={() => navigate(item.href)}
                  className={clsx(
                    "list-row w-full text-sm rounded-md",
                    index === activeIndex && "bg-surface-2 text-text-primary",
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}
