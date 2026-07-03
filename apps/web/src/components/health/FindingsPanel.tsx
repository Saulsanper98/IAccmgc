"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FindingsTable, type HealthFinding } from "./FindingsTable";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";
import { labelDetector } from "@/lib/labels";

const PAGE_SIZE = 20;

export function FindingsPanel({
  items,
  scanInProgress = false,
  byDetector,
  isAdmin,
}: {
  items: HealthFinding[];
  scanInProgress?: boolean;
  byDetector?: Record<string, number>;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [detectorFilter, setDetectorFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  async function requestScan() {
    try {
      const res = await fetch("/api/health/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error");
      toast("Análisis encolado", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    }
  }

  const filtered = useMemo(() => {
    if (!detectorFilter) return items;
    return items.filter((i) => i.detector === detectorFilter);
  }, [items, detectorFilter]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {byDetector && Object.keys(byDetector).length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por detector">
          <button type="button" onClick={() => { setDetectorFilter(null); setPage(0); }}>
            <Badge variant={detectorFilter === null ? "accent" : "muted"}>Todos</Badge>
          </button>
          {Object.entries(byDetector).map(([detector, count]) => (
            <button
              key={detector}
              type="button"
              onClick={() => {
                setDetectorFilter(detector === detectorFilter ? null : detector);
                setPage(0);
              }}
            >
              <Badge variant={detectorFilter === detector ? "accent" : "muted"}>
                {labelDetector(detector)}: {count as number}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <FindingsTable
        items={pageItems}
        scanInProgress={scanInProgress}
        isAdmin={isAdmin}
        onScanRequest={isAdmin ? requestScan : undefined}
        totalCount={filtered.length}
        page={page}
        pageSize={PAGE_SIZE}
      />

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Página {page + 1} de {totalPages}
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
