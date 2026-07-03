"use client";

import { JobStatusBadge } from "@/components/ui/Badge";

const PHASE_LABELS: Record<string, string> = {
  per_page: "Analizando páginas",
  global_detectors: "Detectores globales",
  finalizing: "Finalizando",
  done: "Completado",
};

const DETECTOR_LABELS: Record<string, string> = {
  contradiction: "Buscando contradicciones (LLM, lento)",
  usage_signal: "Señales de uso",
};

export interface HealthScanJob {
  id: string;
  status: string;
  trigger: string;
  stats: Record<string, number | string>;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export function HealthScanProgress({
  scanInProgress,
  recentScans,
}: {
  scanInProgress: boolean;
  recentScans: HealthScanJob[];
}) {
  const latest = recentScans[0];

  if (!latest) return null;

  const running = latest.status === "running" || latest.status === "pending";
  if (!running && !scanInProgress) return null;

  const stats = latest.stats ?? {};
  const total = Number(stats.total_pages ?? 0);
  const scanned = Number(stats.pages_scanned ?? 0);
  const phase = String(stats.phase ?? "");
  const detector = String(stats.current_detector ?? "");
  const created = Number(stats.findings_created ?? 0);

  return (
    <div
      className="surface-card p-4 border-status-warn/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      role="status"
      aria-live="polite"
    >
      <div>
        <div className="flex items-center gap-2">
          <JobStatusBadge status={latest.status} />
          <span className="text-sm font-medium">
            {running ? "Análisis en curso…" : "Último análisis"}
          </span>
        </div>
        <p className="text-sm text-text-secondary mt-1">
          {phase === "per_page" && total > 0
            ? `${PHASE_LABELS.per_page}: ${scanned}/${total} páginas · ${created} hallazgos`
            : phase && PHASE_LABELS[phase]
              ? `${PHASE_LABELS[phase]}${detector ? ` — ${DETECTOR_LABELS[detector] ?? detector}` : ""} · ${created} hallazgos`
              : `Procesando… · ${created} hallazgos`}
        </p>
        {running && (
          <p className="text-xs text-text-muted mt-1">
            El detector de contradicciones usa Ollama y puede tardar varios minutos en CPU.
            Esta página se actualiza sola cada 5 s.
          </p>
        )}
      </div>
      {latest.error && (
        <p className="text-sm text-status-error">{latest.error}</p>
      )}
    </div>
  );
}
