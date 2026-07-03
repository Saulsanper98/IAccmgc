"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { SeverityBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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

  const rowCount = totalCount ?? items.length;

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
          title={scanInProgress ? "Análisis en curso" : "Sin hallazgos abiertos"}
          description={
            scanInProgress
              ? "Los hallazgos aparecerán conforme se detecten."
              : "Ejecuta un análisis para revisar la documentación."
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
                <th scope="col" className="text-right p-4 font-medium text-xs w-12">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={item.id}
                  aria-rowindex={page * pageSize + i + 1}
                  className="border-b border-stroke-subtle last:border-0 align-top hover:bg-surface-1/40 transition-colors"
                >
                  <td className="p-4">
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td className="p-4 text-text-secondary">{labelDetector(item.detector)}</td>
                  <td className="p-4 max-w-md leading-relaxed">{item.summary}</td>
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
                  <td className="p-4 text-right">
                    <DropdownMenu
                      disabled={busy === item.id}
                      label="Acciones del hallazgo"
                      items={STATUS_ACTIONS.map((action) => ({
                        label: action.label,
                        onClick: () => updateStatus(item.id, action.value),
                      }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2" role="list" aria-label={`Hallazgos (${rowCount})`}>
        {items.map((item) => (
          <Card key={item.id} className="!p-4 space-y-2" role="listitem">
            <div className="flex items-start justify-between gap-2">
              <SeverityBadge severity={item.severity} />
              <DropdownMenu
                disabled={busy === item.id}
                label="Acciones del hallazgo"
                items={STATUS_ACTIONS.map((action) => ({
                  label: action.label,
                  onClick: () => updateStatus(item.id, action.value),
                }))}
              />
            </div>
            <p className="text-xs text-text-muted">{labelDetector(item.detector)}</p>
            <p className="text-sm leading-relaxed">{item.summary}</p>
            <a
              href={item.page.wiki_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link text-sm hover:underline"
            >
              {item.page.title}
            </a>
          </Card>
        ))}
      </div>
    </>
  );
}
