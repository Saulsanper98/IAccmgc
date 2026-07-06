"use client";

import clsx from "clsx";
import { friendlyChatStatus, phaseFromStatusMessage } from "@/lib/chat-status";

const PHASE_PROGRESS: Record<string, number> = {
  embedding: 28,
  searching: 62,
  generating: 92,
  started: 12,
};

export function ChatPhaseStepper({
  currentPhase,
  statusMessage,
}: {
  currentPhase?: string | null;
  statusMessage?: string | null;
}) {
  const phase = phaseFromStatusMessage(statusMessage, currentPhase) ?? "started";
  const label = friendlyChatStatus(statusMessage);
  const progress = PHASE_PROGRESS[phase] ?? 12;

  return (
    <div className="py-1 max-w-md" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-accent/30 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
        <p className="text-sm text-text-secondary">{label}</p>
      </div>
      <div
        className="mt-3 h-0.5 rounded-full bg-surface-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={clsx(
            "h-full rounded-full bg-accent/80 motion-safe:transition-all motion-safe:duration-700 ease-out",
            progress >= 90 && "motion-safe:animate-pulse",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
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
  if (chunksFound == null) return null;

  const phase = phaseFromStatusMessage(statusMessage);
  if (phase !== "searching" && phase !== "generating") return null;

  return (
    <p className="text-xs text-text-muted mt-2 tabular-nums">
      {chunksFound} fragmento{chunksFound === 1 ? "" : "s"} relevante{chunksFound === 1 ? "" : "s"}
    </p>
  );
}

/** @deprecated Use phaseFromStatusMessage from @/lib/chat-status */
export function phaseFromStatus(message: string | null): string | null {
  return phaseFromStatusMessage(message);
}
