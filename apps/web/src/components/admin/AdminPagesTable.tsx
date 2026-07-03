"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { IconSearch } from "@/components/ui/Icons";

interface PageRow {
  id: string;
  title: string;
  path: string;
  chunk_count: number;
  wiki_url: string;
}

export function AdminPagesTable({
  items,
  total,
}: {
  items: PageRow[];
  total: number;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) => p.title.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
    );
  }, [items, search]);

  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <div>
      <div className="p-3 border-b border-stroke-subtle relative">
        <IconSearch className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Buscar por título o ruta…"
          className="input-field pl-9 text-sm w-full"
          aria-label="Buscar páginas"
        />
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="text-text-muted border-b border-stroke-subtle sticky top-0 bg-surface-2 z-10">
            <tr>
              <th className="text-left p-3 font-medium">Título</th>
              <th className="text-left p-3 font-medium">Ruta</th>
              <th className="text-left p-3 font-medium">Chunks</th>
              <th className="text-left p-3 font-medium">Wiki</th>
              <th className="text-left p-3 font-medium">Chat</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((pageRow) => (
              <tr key={pageRow.id} className="border-b border-stroke-subtle last:border-0 hover:bg-surface-2/40">
                <td className="p-3">{pageRow.title}</td>
                <td className="p-3 text-text-secondary font-mono text-xs">{pageRow.path}</td>
                <td className="p-3">{pageRow.chunk_count}</td>
                <td className="p-3">
                  <a
                    href={pageRow.wiki_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link hover:underline text-xs"
                  >
                    Abrir ↗
                  </a>
                </td>
                <td className="p-3">
                  <a
                    href={`/chat?q=${encodeURIComponent(`Información sobre ${pageRow.title}`)}`}
                    className="text-link hover:underline text-xs"
                  >
                    Preguntar
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-stroke-subtle max-h-[480px] overflow-y-auto">
        {pageItems.map((pageRow) => (
          <div key={pageRow.id} className="p-4 space-y-2">
            <p className="font-medium text-sm">{pageRow.title}</p>
            <p className="text-xs font-mono text-text-muted truncate">{pageRow.path}</p>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-text-secondary">{pageRow.chunk_count} chunks</span>
              <a href={pageRow.wiki_url} target="_blank" rel="noopener noreferrer" className="text-link">
                Wiki ↗
              </a>
              <a
                href={`/chat?q=${encodeURIComponent(`Información sobre ${pageRow.title}`)}`}
                className="text-link"
              >
                Preguntar
              </a>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-3 border-t border-stroke-subtle text-xs text-text-muted">
          <span>
            {filtered.length} de {total} páginas
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost px-2 py-1"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="btn-ghost px-2 py-1"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
