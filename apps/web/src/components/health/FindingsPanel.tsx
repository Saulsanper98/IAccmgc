"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FindingsTable, type HealthFinding } from "./FindingsTable";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";
import { labelDetector } from "@/lib/labels";

const PAGE_SIZE = 20;

type SeverityFilter = "info" | "warn" | "critical" | null;

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: null, label: "Todas" },
  { value: "critical", label: "Críticos" },
  { value: "warn", label: "Advertencias" },
  { value: "info", label: "Info" },
];

export function FindingsPanel({
  items,
  scanInProgress = false,
  byDetector,
  bySeverity,
  isAdmin,
}: {
  items: HealthFinding[];
  scanInProgress?: boolean;
  byDetector?: Record<string, number>;
  bySeverity?: Record<string, number>;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [detectorFilter, setDetectorFilter] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(null);
  const [page, setPage] = useState(0);
  const tableTopRef = useRef<HTMLDivElement>(null);

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
    let list = items;
    if (detectorFilter) list = list.filter((i) => i.detector === detectorFilter);
    if (severityFilter) list = list.filter((i) => i.severity === severityFilter);
    return list;
  }, [items, detectorFilter, severityFilter]);

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const isFirstPageRef = useRef(true);

  useEffect(() => {
    if (isFirstPageRef.current) {
      isFirstPageRef.current = false;
      return;
    }
    tableTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  function goToPage(next: number) {
    setPage(next);
  }

  return (
    <div className="space-y-4" ref={tableTopRef}>
      {bySeverity && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por severidad">
          {SEVERITY_OPTIONS.map(({ value, label }) => {
            const count = value ? (bySeverity[value] ?? 0) : undefined;
            const active = severityFilter === value;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSeverityFilter(value);
                  setPage(0);
                }}
              >
                <Badge variant={active ? "accent" : "muted"}>
                  {label}
                  {count != null ? `: ${count}` : ""}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {byDetector && Object.keys(byDetector).length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por detector">
          <button
            type="button"
            aria-pressed={detectorFilter === null}
            onClick={() => {
              setDetectorFilter(null);
              setPage(0);
            }}
          >
            <Badge variant={detectorFilter === null ? "accent" : "muted"}>Todos</Badge>
          </button>
          {Object.entries(byDetector).map(([detector, count]) => {
            const active = detectorFilter === detector;
            return (
              <button
                key={detector}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setDetectorFilter(active ? null : detector);
                  setPage(0);
                }}
              >
                <Badge variant={active ? "accent" : "muted"}>
                  {labelDetector(detector)}: {count as number}
                </Badge>
              </button>
            );
          })}
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
              onClick={() => goToPage(page - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn-ghost px-2 py-1"
              disabled={page >= totalPages - 1}
              onClick={() => goToPage(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
