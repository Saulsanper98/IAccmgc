"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { SeverityBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconChevronDown, IconHealth } from "@/components/ui/Icons";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { labelDetector } from "@/lib/labels";

export interface HealthFinding {
  id: string;
  detector: string;
  severity: "info" | "warn" | "critical";
  summary: string;
  status: string;
  evidence: Record<string, unknown>;
  page: { title: string; path: string; wiki_url: string };
}

const STATUS_ACTIONS = [
  { value: "acknowledged", label: "Reconocer" },
  { value: "resolved", label: "Resolver" },
  { value: "false_positive", label: "Falso positivo" },
];

function chatQueryForFinding(item: HealthFinding): string {
  return `Explica el hallazgo «${item.summary}» en la página «${item.page.title}»`;
}

function EvidencePanel({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence ?? {});
  if (entries.length === 0) {
    return <p className="text-xs text-text-muted">Sin evidencia adicional.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{key}</p>
          <pre className="text-xs whitespace-pre-wrap break-words text-text-secondary mt-0.5">
            {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
          </pre>
        </div>
      ))}
      <details className="text-xs">
        <summary className="cursor-pointer text-link hover:underline">Ver JSON completo</summary>
        <pre className="mt-2 p-2 rounded-md bg-surface-1 border border-stroke-subtle overflow-x-auto max-h-48">
          {JSON.stringify(evidence, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function FindingsTable({
  items,
  scanInProgress = false,
  isAdmin,
  onScanRequest,
  totalCount,
  page = 0,
  pageSize = 20,
}: {
  items: HealthFinding[];
  scanInProgress?: boolean;
  isAdmin?: boolean;
  onScanRequest?: () => void;
  totalCount?: number;
  page?: number;
  pageSize?: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rowCount = totalCount ?? items.length;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function updateStatus(id: string, status: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/health/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error");
      toast("Estado actualizado", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!items.length) {
    return (
      <Card>
        <EmptyState
          icon={<IconHealth className="w-10 h-10" />}
          title={scanInProgress ? "Análisis en curso" : "Sin hallazgos abiertos"}
          description={
            scanInProgress
              ? "Los hallazgos aparecerán conforme se detecten."
              : isAdmin
                ? "Ejecuta un análisis para revisar la documentación."
                : "No hay hallazgos visibles. Contacta con un administrador si esperabas ver resultados."
          }
          actionLabel={!scanInProgress && isAdmin ? "Ejecutar análisis" : undefined}
          onAction={!scanInProgress && isAdmin ? onScanRequest : undefined}
        />
      </Card>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <Card padding={false} className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm"
            aria-rowcount={rowCount}
            aria-label="Hallazgos de salud documental"
          >
            <caption className="sr-only">
              Hallazgos de salud documental — mostrando {items.length} de {rowCount}
            </caption>
            <thead className="text-text-muted border-b border-stroke-subtle">
              <tr>
                <th scope="col" className="text-left p-4 font-medium text-xs w-8">
                  <span className="sr-only">Expandir</span>
                </th>
                <th scope="col" className="text-left p-4 font-medium text-xs">
                  Severidad
                </th>
                <th scope="col" className="text-left p-4 font-medium text-xs">
                  Detector
                </th>
                <th scope="col" className="text-left p-4 font-medium text-xs">
                  Resumen
                </th>
                <th scope="col" className="text-left p-4 font-medium text-xs">
                  Página
                </th>
                <th scope="col" className="text-left p-4 font-medium text-xs">
                  Chat
                </th>
                <th scope="col" className="text-right p-4 font-medium text-xs w-12">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const isExpanded = expanded.has(item.id);
                return (
                  <tr
                    key={item.id}
                    aria-rowindex={page * pageSize + i + 1}
                    className="border-b border-stroke-subtle last:border-0 align-top hover:bg-surface-1/40 transition-colors"
                  >
                    <td className="p-4">
                      <button
                        type="button"
                        className="btn-icon !min-h-[32px] !min-w-[32px]"
                        onClick={() => toggleExpanded(item.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Ocultar evidencia" : "Ver evidencia"}
                      >
                        <IconChevronDown
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </td>
                    <td className="p-4">
                      <SeverityBadge severity={item.severity} />
                    </td>
                    <td className="p-4 text-text-secondary">{labelDetector(item.detector)}</td>
                    <td className="p-4 max-w-md leading-relaxed">
                      <p>{item.summary}</p>
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-stroke-subtle">
                          <EvidencePanel evidence={item.evidence} />
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <a
                        href={item.page.wiki_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link hover:underline"
                      >
                        {item.page.title}
                      </a>
                    </td>
                    <td className="p-4">
                      <a
                        href={`/chat?q=${encodeURIComponent(chatQueryForFinding(item))}`}
                        className="text-link hover:underline text-xs"
                      >
                        Preguntar
                      </a>
                    </td>
                    <td className="p-4 text-right">
                      {isAdmin && (
                        <DropdownMenu
                          disabled={busy === item.id}
                          label="Acciones del hallazgo"
                          items={STATUS_ACTIONS.map((action) => ({
                            label: action.label,
                            onClick: () => updateStatus(item.id, action.value),
                          }))}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2" role="list" aria-label={`Hallazgos (${rowCount})`}>
        {items.map((item) => {
          const isExpanded = expanded.has(item.id);
          return (
            <Card key={item.id} className="!p-4 space-y-2" role="listitem">
              <div className="flex items-start justify-between gap-2">
                <SeverityBadge severity={item.severity} />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn-icon !min-h-[32px] !min-w-[32px]"
                    onClick={() => toggleExpanded(item.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Ocultar evidencia" : "Ver evidencia"}
                  >
                    <IconChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isAdmin && (
                    <DropdownMenu
                      disabled={busy === item.id}
                      label="Acciones del hallazgo"
                      items={STATUS_ACTIONS.map((action) => ({
                        label: action.label,
                        onClick: () => updateStatus(item.id, action.value),
                      }))}
                    />
                  )}
                </div>
              </div>
              <p className="text-xs text-text-muted">{labelDetector(item.detector)}</p>
              <p className="text-sm leading-relaxed">{item.summary}</p>
              {isExpanded && <EvidencePanel evidence={item.evidence} />}
              <div className="flex flex-wrap gap-3 text-sm">
                <a
                  href={item.page.wiki_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link hover:underline"
                >
                  {item.page.title}
                </a>
                <a
                  href={`/chat?q=${encodeURIComponent(chatQueryForFinding(item))}`}
                  className="text-link hover:underline text-xs"
                >
                  Preguntar en chat
                </a>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
