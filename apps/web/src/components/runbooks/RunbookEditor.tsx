"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { useToast } from "@/components/ui/ToastProvider";
import { RunbookStatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

interface Step {
  id: string;
  ordinal: number;
  title: string;
  instructions_md: string;
  expected_result: string;
  is_checkpoint: boolean;
  variables: { name: string; description: string; default: string }[];
}

interface RunbookDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  version: number;
  steps: Step[];
}

export function RunbookEditor({
  runbook,
  canEdit,
}: {
  runbook: RunbookDetail;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(runbook.title);
  const [steps, setSteps] = useState(runbook.steps);
  const [saving, setSaving] = useState(false);

  function moveStep(index: number, direction: -1 | 1) {
    const next = [...steps];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next.map((s, i) => ({ ...s, ordinal: i + 1 })));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/runbooks/${runbook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          steps: steps.map((s) => ({
            title: s.title,
            instructions_md: s.instructions_md,
            expected_result: s.expected_result,
            is_checkpoint: s.is_checkpoint,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error");
      toast("Runbook guardado", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setSaving(true);
    try {
      const response = await fetch(`/api/runbooks/${runbook.id}/publish`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Error");
      toast("Runbook publicado", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <RunbookStatusBadge status={runbook.status} />
        <span className="text-xs text-text-muted tabular-nums">
          v{runbook.version} · {runbook.steps.length} pasos
        </span>
        {canEdit && (
          <>
            <button type="button" onClick={save} disabled={saving} className="btn-secondary btn-sm">
              Guardar
            </button>
            {runbook.status === "draft" && (
              <button type="button" onClick={publish} disabled={saving} className="btn-primary btn-sm btn-pill">
                Publicar
              </button>
            )}
          </>
        )}
        {runbook.status === "published" && (
          <a href={`/runbooks/${runbook.id}/execute`} className="btn-primary btn-sm btn-pill">
            Ejecutar
          </a>
        )}
      </div>

      {canEdit ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-field text-xl font-semibold w-full bg-transparent border-0 border-b border-stroke-subtle rounded-none px-0"
          aria-label="Título del runbook"
        />
      ) : (
        <h1 className="page-title">{title}</h1>
      )}

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Card className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-muted uppercase tracking-wide">Paso {step.ordinal}</span>
              {canEdit && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveStep(index, -1)} className="btn-icon !min-h-[36px] !min-w-[36px]" aria-label="Subir paso">↑</button>
                  <button type="button" onClick={() => moveStep(index, 1)} className="btn-icon !min-h-[36px] !min-w-[36px]" aria-label="Bajar paso">↓</button>
                </div>
              )}
            </div>
            {canEdit ? (
              <>
                <input
                  value={step.title}
                  onChange={(e) => {
                    const next = [...steps];
                    next[index] = { ...step, title: e.target.value };
                    setSteps(next);
                  }}
                  className="input-field w-full mb-2 font-medium"
                />
                <textarea
                  value={step.instructions_md}
                  onChange={(e) => {
                    const next = [...steps];
                    next[index] = { ...step, instructions_md: e.target.value };
                    setSteps(next);
                  }}
                  rows={6}
                  className="input-field w-full text-sm leading-relaxed"
                />
              </>
            ) : (
              <>
                <h3 className="font-medium">{step.title}</h3>
                <MarkdownContent content={step.instructions_md} className="mt-2 text-sm" />
              </>
            )}
            {step.is_checkpoint && (
              <p className="text-xs text-status-warn mt-2">Checkpoint — requiere nota al completar</p>
            )}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
