"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { IconRefresh } from "@/components/ui/Icons";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

interface ComponentHealth {
  name: string;
  status: "ok" | "degraded" | "down";
  latency_ms: number | null;
  message: string | null;
}

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  components: ComponentHealth[];
}

const statusLabels: Record<string, string> = {
  ok: "Operativo",
  degraded: "Degradado",
  down: "No disponible",
};

const statusColors: Record<string, string> = {
  ok: "text-status-ok",
  degraded: "text-status-warn",
  down: "text-status-error",
};

const hints: Record<string, string> = {
  ollama: "Ejecuta Ollama en el host y verifica OLLAMA_BASE_URL",
  database: "Comprueba que PostgreSQL esté levantado en Docker",
  redis: "Comprueba el contenedor redis",
};

export function HealthStatusPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/backend/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return (
      <Card className="space-y-3" aria-busy="true" aria-label="Cargando estado">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-2 rounded-md animate-pulse" />
        ))}
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-l-2 border-status-error" role="alert">
        <p className="text-status-error text-sm">No se pudo conectar con la API: {error}</p>
        <p className="text-text-muted text-xs mt-2">
          Verifica que los servicios estén levantados con{" "}
          <code className="text-text-secondary">docker compose up</code>.
        </p>
        <button type="button" onClick={fetchHealth} className="btn-ghost text-xs mt-3">
          <IconRefresh className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </Card>
    );
  }

  if (!health) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Badge variant={health.status === "ok" ? "ok" : health.status === "degraded" ? "warn" : "error"}>
            {statusLabels[health.status]}
          </Badge>
          <span className="text-text-muted text-xs">API v{health.version}</span>
        </div>
        <button
          type="button"
          onClick={fetchHealth}
          className="btn-ghost p-1.5 text-xs"
          aria-label="Actualizar estado"
        >
          <IconRefresh className="w-4 h-4" />
        </button>
      </div>

      <ul className="space-y-3" role="list">
        {health.components.map((component) => (
          <li
            key={component.name}
            className="flex items-start justify-between gap-4 py-2 border-b border-stroke-subtle last:border-0"
          >
            <div>
              <span className="text-sm font-medium capitalize">{component.name}</span>
              {component.message && (
                <p className="text-xs text-text-muted mt-0.5">{component.message}</p>
              )}
              {component.status === "down" && hints[component.name] && (
                <p className="text-xs text-status-warn mt-1">{hints[component.name]}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className={clsx("text-xs font-medium", statusColors[component.status])}>
                {statusLabels[component.status]}
              </span>
              {component.latency_ms != null && (
                <p className="text-xs text-text-muted">{component.latency_ms} ms</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
