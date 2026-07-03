"use client";

import clsx from "clsx";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconSearch } from "./Icons";

export interface WikiPageOption {
  id: string;
  title: string;
  path: string;
}

export function WikiPageCombobox({
  pages,
  value,
  onChange,
  label,
  placeholder = "Buscar página…",
  disabled,
}: {
  pages: WikiPageOption[];
  value: string;
  onChange: (pageId: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = pages.find((p) => p.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages.slice(0, 50);
    return pages
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [pages, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function selectPage(id: string) {
    onChange(id);
    const page = pages.find((p) => p.id === id);
    setQuery(page?.title ?? "");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <label className="block text-sm">
        <span className="text-text-muted block mb-1">{label}</span>
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={label}
            disabled={disabled}
            value={open ? query : (selected?.title ?? query)}
            placeholder={placeholder}
            className="input-field w-full pl-8"
            onFocus={() => {
              setOpen(true);
              setQuery(selected?.title ?? "");
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (!e.target.value.trim()) onChange("");
            }}
            onKeyDown={(e) => {
              if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
                setOpen(true);
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter" && filtered[highlight]) {
                e.preventDefault();
                selectPage(filtered[highlight].id);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
        </div>
      </label>

      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto surface-card-elevated border border-stroke-subtle rounded-lg shadow-elevated py-1"
        >
          {filtered.map((page, i) => (
            <li key={page.id} role="option" aria-selected={value === page.id}>
              <button
                type="button"
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-surface-1",
                  i === highlight && "bg-surface-1",
                  value === page.id && "text-link",
                )}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => selectPage(page.id)}
              >
                <span className="block truncate">{page.title}</span>
                <span className="block text-[10px] text-text-muted font-mono truncate">{page.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && query.trim() && (
        <p className="absolute z-20 mt-1 w-full px-3 py-2 text-sm text-text-muted surface-card border border-stroke-subtle rounded-lg">
          Sin resultados
        </p>
      )}
    </div>
  );
}
