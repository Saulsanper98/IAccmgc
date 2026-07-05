"use client";

import clsx from "clsx";
import { phaseFromStatusMessage, statusMentionsChunks } from "@/lib/chat-status";

const PHASES = [
  { key: "embedding", label: "Generando embedding" },
  { key: "searching", label: "Buscando contexto" },
  { key: "generating", label: "Generando respuesta" },
] as const;

export function ChatPhaseStepper({
  currentPhase,
  statusMessage,
}: {
  currentPhase?: string | null;
  statusMessage?: string | null;
}) {
  const phase = phaseFromStatusMessage(statusMessage, currentPhase);
  if (!phase || phase === "started") return null;

  const activeIndex = PHASES.findIndex((p) => p.key === phase);

  return (
    <div className="flex items-center gap-1 text-xs flex-wrap" aria-label="Progreso de la consulta">
      {PHASES.map((phaseItem, i) => (
        <div key={phaseItem.key} className="flex items-center gap-1">
          <span
            className={clsx(
              "px-2 py-0.5 rounded-full border",
              i <= activeIndex
                ? "border-accent/50 text-accent bg-accent/10"
                : "border-stroke-subtle text-text-muted",
            )}
          >
            {phaseItem.label}
          </span>
          {i < PHASES.length - 1 && (
            <span className="text-text-muted" aria-hidden>
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function RagProgressIndicator({
  chunksFound,
  statusMessage,
}: {
  chunksFound?: number | null;
  statusMessage?: string | null;
}) {
  const show = chunksFound != null || statusMentionsChunks(statusMessage);
  if (!show) return null;

  const count = chunksFound ?? null;
  const label =
    count != null
      ? `${count} fragmento${count === 1 ? "" : "s"} encontrado${count === 1 ? "" : "s"}`
      : "Analizando fragmentos…";

  return (
    <p className="text-xs text-text-muted mt-2 flex items-center gap-2">
      <span className="inline-flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-accent/60 motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </span>
      {label}
    </p>
  );
}

/** @deprecated Use phaseFromStatusMessage from @/lib/chat-status */
export function phaseFromStatus(message: string | null): string | null {
  return phaseFromStatusMessage(message);
}
