"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import type { ConversationSummary } from "@/lib/chat-types";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface CommandItem {
  id: string;
  label: string;
  href: string;
  keywords?: string;
  group: "section" | "action" | "conversation";
}

const SECTION_COMMANDS: Omit<CommandItem, "group">[] = [
  { id: "home", label: "Inicio", href: "/", keywords: "home inicio" },
  { id: "chat", label: "Chat", href: "/chat", keywords: "chat conversación preguntar" },
  { id: "salud", label: "Salud documental", href: "/salud", keywords: "salud health hallazgos" },
  { id: "runbooks", label: "Runbooks", href: "/runbooks", keywords: "runbooks procedimientos" },
  { id: "admin", label: "Administración", href: "/admin", keywords: "admin ingesta sync" },
];

const ACTION_COMMANDS: Omit<CommandItem, "group">[] = [
  { id: "new-chat", label: "Nueva conversación", href: "/chat", keywords: "nueva chat new crear" },
  { id: "salud-scan", label: "Ir a salud documental", href: "/salud", keywords: "escaneo scan hallazgos" },
];

export function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  useFocusTrap(open, dialogRef, close);

  const items: CommandItem[] = [
    ...ACTION_COMMANDS.map((item) => ({ ...item, group: "action" as const })),
    ...SECTION_COMMANDS.filter((item) => item.id !== "admin" || isAdmin).map((item) => ({
      ...item,
      group: "section" as const,
    })),
    ...conversations.map((conv) => ({
      id: `conv-${conv.id}`,
      label: conv.title,
      href: `/chat/${conv.id}`,
      keywords: conv.title,
      group: "conversation" as const,
    })),
  ].filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.keywords?.toLowerCase().includes(q)
    );
  });

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
      void fetch("/api/chat/conversations")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data) => setConversations(data.items ?? []))
        .catch(() => setConversations([]));
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const GROUP_ORDER: CommandItem["group"][] = ["action", "section", "conversation"];
  const GROUP_HEADERS: Record<CommandItem["group"], string> = {
    action: "Acciones",
    section: "Secciones",
    conversation: "Conversaciones",
  };

  function renderItem(item: CommandItem, index: number) {
    return (
      <li
        key={item.id}
        id={`${listboxId}-option-${item.id}`}
        role="option"
        aria-selected={index === activeIndex}
      >
        <button
          type="button"
          onClick={() => navigate(item.href)}
          className={clsx(
            "list-row w-full text-sm rounded-md",
            index === activeIndex && "bg-surface-2 text-text-primary",
          )}
        >
          <span className="truncate">{item.label}</span>
        </button>
      </li>
    );
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
        aria-label="Cerrar paleta de comandos"
        onClick={close}
      />
      <div
        ref={dialogRef}
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
            placeholder="Ir a sección, acción o conversación…"
            className="input-field !min-h-[40px] text-sm"
            aria-label="Buscar sección, acción o conversación"
            aria-controls={listboxId}
            aria-activedescendant={
              items[activeIndex] ? `${listboxId}-option-${items[activeIndex].id}` : undefined
            }
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
          />
          <p className="meta-caption mt-2 px-1">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px]">↑↓</kbd> navegar ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px]">Enter</kbd> ir ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px]">Esc</kbd> cerrar
          </p>
        </div>
        <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto p-1">
          {items.length === 0 ? (
            <li className="px-3 py-4 text-sm text-text-muted text-center">Sin resultados</li>
          ) : (
            GROUP_ORDER.map((group) => {
              const groupItems = items
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.group === group);
              if (groupItems.length === 0) return null;
              return (
                <li key={group} role="presentation" className="mb-1 last:mb-0">
                  <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                    {GROUP_HEADERS[group]}
                  </div>
                  <ul role="group" aria-label={GROUP_HEADERS[group]}>
                    {groupItems.map(({ item, index }) => renderItem(item, index))}
                  </ul>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </>
  );
}
