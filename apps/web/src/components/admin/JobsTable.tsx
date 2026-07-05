"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { JobStatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { IconChevronDown } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/ToastProvider";

export interface IngestJob {
  id: string;
  type: string;
  status: string;
  started_at: string | null;
  finished_at?: string | null;
  stats: Record<string, number>;
  error: string | null;
}

type SortKey = "type" | "status" | "started_at";
type SortDir = "asc" | "desc";

function jobProgress(job: IngestJob): number | null {
  if (job.status !== "running") return job.status === "completed" ? 100 : null;
  const seen = job.stats?.pages_seen ?? 0;
  const upserted = job.stats?.pages_upserted ?? 0;
  const total = seen || upserted;
  if (!total) return null;
  return Math.min(100, Math.round((upserted / total) * 100));
}

export function JobsTable({ jobs }: { jobs: IngestJob[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey>("started_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const prevStatusesRef = useRef<Map<string, string>>(new Map());

  const hasActiveJob = jobs.some((j) => j.status === "running" || j.status === "pending");

  useEffect(() => {
    if (!hasActiveJob) return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [hasActiveJob, router]);

  useEffect(() => {
    const prev = prevStatusesRef.current;
    for (const job of jobs) {
      const was = prev.get(job.id);
      if (was && (was === "running" || was === "pending")) {
        if (job.status === "completed") {
          toast(`Sync ${job.type} completado`, "success");
        } else if (job.status === "failed") {
          toast(`Sync ${job.type} falló`, "error");
        }
      }
      prev.set(job.id, job.status);
    }
  }, [jobs, toast]);

  const sorted = useMemo(() => {
    let list = [...jobs];
    if (statusFilter !== "all") {
      list = list.filter((j) => j.status === statusFilter);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "started_at") {
        cmp = (a.started_at ?? "").localeCompare(b.started_at ?? "");
      } else if (sortKey === "type") {
        cmp = a.type.localeCompare(b.type);
      } else {
        cmp = a.status.localeCompare(b.status);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [jobs, sortKey, sortDir, statusFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleError(id: string) {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs text-text-muted flex items-center gap-2">
          Estado
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field text-xs py-1"
            aria-label="Filtrar por estado"
          >
            <option value="all">Todos</option>
            <option value="running">En curso</option>
            <option value="completed">Completados</option>
            <option value="failed">Fallidos</option>
            <option value="pending">Pendientes</option>
          </select>
        </label>
      </div>

      <Card padding={false} className="overflow-hidden">
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Trabajos de ingesta recientes</caption>
            <thead className="text-text-muted border-b border-stroke-subtle bg-surface-1 sticky top-0">
              <tr>
                <th scope="col" className="text-left p-3 font-medium">
                  <button type="button" className="hover:text-text-primary" onClick={() => toggleSort("type")}>
                    Tipo {sortKey === "type" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th scope="col" className="text-left p-3 font-medium">
                  <button type="button" className="hover:text-text-primary" onClick={() => toggleSort("status")}>
                    Estado {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th scope="col" className="text-left p-3 font-medium">
                  <button type="button" className="hover:text-text-primary" onClick={() => toggleSort("started_at")}>
                    Inicio {sortKey === "started_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
                <th scope="col" className="text-left p-3 font-medium min-w-[140px]">
                  Progreso
                </th>
                <th scope="col" className="text-left p-3 font-medium">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((job) => {
                const progress = jobProgress(job);
                const errorExpanded = expandedErrors.has(job.id);
                return (
                  <tr key={job.id} className="border-b border-stroke-subtle last:border-0 align-top">
                    <td className="p-3 capitalize">{job.type}</td>
                    <td className="p-3">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="p-3 text-text-secondary">
                      {job.started_at ? new Date(job.started_at).toLocaleString("es-ES") : "—"}
                    </td>
                    <td className="p-3">
                      {progress != null ? (
                        <div className="space-y-1">
                          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-link)] transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-text-muted tabular-nums">{progress}%</span>
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="p-3 text-text-secondary">
                      {job.error ? (
                        <div className="space-y-1">
                          <button
                            type="button"
                            className="flex items-center gap-1 text-status-error text-left hover:underline"
                            onClick={() => toggleError(job.id)}
                            aria-expanded={errorExpanded}
                          >
                            <IconChevronDown
                              className={`w-3.5 h-3.5 shrink-0 transition-transform ${errorExpanded ? "rotate-180" : ""}`}
                            />
                            <span className="line-clamp-1">{job.error}</span>
                          </button>
                          {errorExpanded && (
                            <pre className="text-xs whitespace-pre-wrap break-words p-2 rounded-md bg-status-error/5 border border-status-error/20 max-h-40 overflow-y-auto">
                              {job.error}
                            </pre>
                          )}
                        </div>
                      ) : job.status === "running" ? (
                        `${job.stats?.pages_upserted ?? 0}/${job.stats?.pages_seen ?? "?"} págs`
                      ) : (
                        `${job.stats?.pages_upserted ?? 0} págs · ${job.stats?.chunks_created ?? 0} chunks`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
