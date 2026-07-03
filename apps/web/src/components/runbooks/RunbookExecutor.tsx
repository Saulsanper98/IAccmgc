"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { Accordion } from "@/components/ui/Accordion";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { StepStatusBadge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

interface Step {
  id: string;
  ordinal: number;
  title: string;
  instructions_md: string;
  expected_result: string;
  is_checkpoint: boolean;
  status: string | null;
}

interface SessionData {
  id: string;
  runbook_id: string;
  steps: Step[];
  context: Record<string, string>;
  outcome: string | null;
}

export function RunbookExecutor({
  runbookId,
  runbookTitle,
  runbookVersion,
  steps,
  variables,
}: {
  runbookId: string;
  runbookTitle: string;
  runbookVersion: number;
  steps: Step[];
  variables: { name: string; description: string; default: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [context, setContext] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v.name, v.default || ""])),
  );
  const [session, setSession] = useState<SessionData | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const uniqueVars = useMemo(() => {
    const raw = variables.length
      ? variables
      : steps.flatMap((s) => {
          const matches = s.instructions_md.match(/\{\{(\w+)\}\}/g) ?? [];
          return matches.map((m) => ({
            name: m.replace(/\{\{|\}\}/g, ""),
            description: "",
            default: "",
          }));
        });
    const seen = new Set<string>();
    return raw.filter((v) => {
      if (seen.has(v.name)) return false;
      seen.add(v.name);
      return true;
    });
  }, [variables, steps]);

  const activeSteps = session?.steps ?? steps;
  const completedCount = activeSteps.filter((s) => s.status).length;
  const currentStep = activeSteps.find((s) => !s.status) ?? activeSteps[activeSteps.length - 1];
  const allDone = activeSteps.every((s) => s.status);
  const progress = Math.round((completedCount / activeSteps.length) * 100);
  const versionLabel = `v${runbookVersion} · ${activeSteps.length} pasos`;

  async function startSession() {
    setLoading(true);
    try {
      const response = await fetch(`/api/runbooks/${runbookId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error");
      setSession(data);
      toast("Sesión iniciada", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setLoading(false);
    }
  }

  async function completeStep(stepId: string, status: string) {
    if (!session) return;
    const note = notes[stepId]?.trim() || null;
    setLoading(true);
    try {
      const response = await fetch(`/api/runbooks/sessions/${session.id}/steps/${stepId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error");
      setSession(data);
      setNotes((prev) => {
        const next = { ...prev };
        delete next[stepId];
        return next;
      });
      toast("Paso registrado", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setLoading(false);
    }
  }

  async function undoLastStep() {
    if (!session) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/runbooks/sessions/${session.id}/undo`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error");
      setSession(data);
      toast("Paso anterior restaurado", "info");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setLoading(false);
    }
  }

  async function finish(outcome: string) {
    if (!session) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/runbooks/sessions/${session.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error");
      toast("Sesión finalizada", "success");
      router.push(`/runbooks/${runbookId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Breadcrumb
          items={[
            { label: "Runbooks", href: "/runbooks" },
            { label: runbookTitle, href: `/runbooks/${runbookId}` },
            { label: "Ejecutar" },
          ]}
          className="mb-2"
        />
        <p className="text-xs text-text-muted">{versionLabel}</p>
        <Card className="max-w-md mx-auto space-y-4">
          <h2 className="text-base font-semibold tracking-tight">Variables</h2>
          {uniqueVars.length === 0 && (
            <p className="text-sm text-text-muted">Este runbook no requiere variables.</p>
          )}
          {uniqueVars.map((v) => (
            <label key={v.name} className="block text-sm">
              <span className="text-text-muted text-xs uppercase tracking-wide">{v.name}</span>
              <input
                value={context[v.name] ?? ""}
                onChange={(e) => setContext({ ...context, [v.name]: e.target.value })}
                className="input-field w-full mt-1"
              />
            </label>
          ))}
          <button type="button" onClick={startSession} disabled={loading} className="btn-primary btn-pill w-full">
            Iniciar ejecución
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="sticky top-0 z-10 bg-surface-0/95 backdrop-blur-md py-3 -mx-4 px-4 border-b border-stroke-subtle space-y-2">
        <Breadcrumb
          items={[
            { label: "Runbooks", href: "/runbooks" },
            { label: runbookTitle, href: `/runbooks/${runbookId}` },
            { label: "Ejecutar" },
          ]}
        />
        <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
          <span>{versionLabel}</span>
          <span aria-live="polite">
            Paso {completedCount + (allDone ? 0 : 1)} de {activeSteps.length} · {progress}%
          </span>
        </div>
        <div
          className="h-1.5 rounded-full bg-surface-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso del runbook"
        >
          <div
            className="h-full bg-link transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {!allDone && currentStep && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold tracking-tight">
              {currentStep.ordinal}. {currentStep.title}
            </h3>
          </div>
          <MarkdownContent content={currentStep.instructions_md} className="text-sm" />
          {currentStep.expected_result && (
            <p className="text-xs text-text-muted">Esperado: {currentStep.expected_result}</p>
          )}
          {currentStep.is_checkpoint && (
            <label className="block text-sm">
              <span className="text-text-muted text-xs">Nota de checkpoint (obligatoria)</span>
              <input
                id={`checkpoint-note-${currentStep.id}`}
                value={notes[currentStep.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [currentStep.id]: e.target.value })}
                placeholder="Describe lo verificado en este punto"
                className="input-field w-full text-sm mt-1"
                aria-required="true"
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {completedCount > 0 && (
              <button
                type="button"
                disabled={loading}
                onClick={undoLastStep}
                className="btn-secondary btn-sm"
              >
                Paso anterior
              </button>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => completeStep(currentStep.id, "done")}
              className="btn-primary btn-pill flex-1"
            >
              Hecho
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => completeStep(currentStep.id, "skipped")}
              className="btn-secondary btn-sm"
            >
              Omitir
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => completeStep(currentStep.id, "failed")}
              className="btn-ghost btn-sm text-status-error"
            >
              Fallido
            </button>
          </div>
        </Card>
      )}

      {allDone && (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => finish("completed")} className="btn-primary btn-pill">
            Completar runbook
          </button>
          <button type="button" onClick={() => finish("aborted")} className="btn-secondary">
            Abortar
          </button>
        </div>
      )}

      <Accordion title="Ver todos los pasos">
        <ol className="space-y-2">
          {activeSteps.map((step) => (
            <li key={step.id} className={`list-row text-sm ${step.status ? "opacity-60" : ""}`}>
              <span className="flex-1 truncate">
                {step.ordinal}. {step.title}
              </span>
              {step.status ? <StepStatusBadge status={step.status} /> : null}
            </li>
          ))}
        </ol>
      </Accordion>
    </div>
  );
}
