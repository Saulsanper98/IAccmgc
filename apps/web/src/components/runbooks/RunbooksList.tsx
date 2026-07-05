"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { IconRunbook, IconSearch } from "@/components/ui/Icons";
import { WikiPageCombobox } from "@/components/ui/WikiPageCombobox";
import { RunbookStatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

export interface RunbookItem {
  id: string;
  title: string;
  description: string;
  status: string;
  version: number;
  step_count: number;
  updated_at: string | null;
}

type SortKey = "title" | "updated_at" | "step_count";
type SortDir = "asc" | "desc";

function formatVersionMeta(version: number, stepCount: number) {
  return `v${version} · ${stepCount} pasos`;
}

export function RunbooksList({
  items,
  canEdit,
  wikiPages,
}: {
  items: RunbookItem[];
  canEdit: boolean;
  wikiPages: { id: string; title: string; path: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pageId, setPageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function createFromPage() {
    if (!pageId) return;
    setLoading(true);
    try {
      const response = await fetch("/api/runbooks/from-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error");
      toast("Runbook creado en borrador", "success");
      router.push(`/runbooks/${data.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (q
      ? items.filter(
          (rb) =>
            rb.title.toLowerCase().includes(q) || rb.description.toLowerCase().includes(q),
        )
      : [...items]
    ).slice();
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title, "es");
      else if (sortKey === "step_count") cmp = a.step_count - b.step_count;
      else cmp = (a.updated_at ?? "").localeCompare(b.updated_at ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [items, search, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      {canEdit && wikiPages.length > 0 && (
        <Card className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <WikiPageCombobox
              pages={wikiPages}
              value={pageId}
              onChange={setPageId}
              label="Convertir página wiki en runbook"
              disabled={loading}
            />
          </div>
          <button
            type="button"
            onClick={createFromPage}
            disabled={!pageId || loading}
            className="btn-primary text-sm shrink-0"
          >
            {loading ? "Generando…" : "Generar borrador"}
          </button>
        </Card>
      )}

      {items.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar runbooks…"
              className="input-field pl-9 text-sm w-full"
              aria-label="Buscar runbooks"
            />
          </div>
          <label className="text-xs text-text-muted flex items-center gap-2 shrink-0">
            Ordenar
            <select
              value={`${sortKey}-${sortDir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split("-") as [SortKey, SortDir];
                setSortKey(key);
                setSortDir(dir);
              }}
              className="input-field text-xs py-1"
              aria-label="Ordenar runbooks"
            >
              <option value="title-asc">Título A–Z</option>
              <option value="title-desc">Título Z–A</option>
              <option value="updated_at-desc">Más recientes</option>
              <option value="updated_at-asc">Más antiguos</option>
              <option value="step_count-desc">Más pasos</option>
              <option value="step_count-asc">Menos pasos</option>
            </select>
          </label>
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconRunbook className="w-10 h-10" />}
            title="Sin runbooks"
            description="Genera uno desde una página de la wiki para empezar."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="Sin coincidencias" description="Prueba con otros términos de búsqueda." />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((rb) => (
            <Link
              key={rb.id}
              href={`/runbooks/${rb.id}`}
              className="list-row surface-card !rounded-lg hover:bg-surface-2/80 block"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{rb.title}</h3>
                <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{rb.description}</p>
              </div>
              <RunbookStatusBadge status={rb.status} />
              <span className="text-xs text-text-muted shrink-0 tabular-nums">
                {formatVersionMeta(rb.version, rb.step_count)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
